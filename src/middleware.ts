import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Edge gate for /admin and /api/admin.
 *
 * This is a defense-in-depth layer — every admin page also enforces its own
 * role + permission gate via `getSession()` + admin-permissions helpers.
 * The middleware just rejects clearly-unauthenticated requests early so the
 * Node-runtime page handlers don't have to spin up.
 *
 * Things to remember:
 *   - Both `ADMIN` and `MASTER_ADMIN` are valid admin roles. Hard-coding
 *     `=== "ADMIN"` here was the source of a redirect loop where master
 *     admins got bounced to `/` (which then funneled them to the public
 *     onboarding page). Treat both roles equivalently.
 *   - `/admin/onboarding` must stay reachable for INVITED admins whose
 *     `adminStatus` is INVITED — they need to set their password / accept
 *     the rules before any other admin route will admit them. The role
 *     check still applies (must be ADMIN or MASTER_ADMIN), but the
 *     onboarding-completion check is intentionally NOT enforced here. The
 *     staff layout owns that gate so it can also handle DISABLED /
 *     SUSPENDED / REMOVED with a friendly notice.
 */

const ADMIN_ROLES = new Set(["ADMIN", "MASTER_ADMIN"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin") && !isAdminApi;

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Unauthenticated → 401 for APIs, redirect to sign-in for pages.
  if (!token) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Role gate. Accept both ADMIN and MASTER_ADMIN.
  if (typeof token.role !== "string" || !ADMIN_ROLES.has(token.role)) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
