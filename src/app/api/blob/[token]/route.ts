/**
 * GET /api/blob/<token>
 *
 * Proxy route for privately-served Vercel Blob bytes. Decrypts the
 * token, authorizes the request, and streams the bytes back. Never
 * exposes the underlying Vercel Blob URL to the client.
 *
 * Auth model:
 *   1. Must be signed in (otherwise 401).
 *   2. Must EITHER:
 *      a. Own the record that references this proxy URL, OR
 *      b. Be an admin/master admin (any verification reviewer).
 *
 * Ownership is determined by searching the three tables that store
 * upload URLs:
 *   - VerificationRequest (studentIdUrl, proofUrl, rosterUrl)
 *   - AthleteProgramConnection (rosterUrl, recruitingProofUrl)
 *   - StudentUniversityConnection (studentIdUrl, proofUrl)
 *
 * If no record references the proxy URL at all, we 404 — an
 * orphaned upload isn't viewable by anyone (this also prevents
 * uploaders from holding a token for content they never associated
 * with a record).
 */
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { decryptBlobToken } from "@/lib/blob-token";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;

  // 1. Decrypt — invalid / tampered tokens fall through to a 404 so we
  //    don't tip off attackers about token format details. The token
  //    encrypts the blob's pathname (e.g. "verification/2026-05/abc.jpg")
  //    not its full URL, because private blobs are fetched by pathname.
  const pathname = decryptBlobToken(token);
  if (!pathname) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Auth.
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // 3. Authorize — admins can view everything; regular users can only
  //    view blobs attached to records they own.
  const proxyUrl = `/api/blob/${token}`;
  if (!isAdmin(session)) {
    const userId = session.user.id;
    const ownedByUser = await findOwningRecord(proxyUrl, userId);
    if (!ownedByUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // Admin path — still confirm the proxyUrl IS referenced by some
    // record, so admins can't browse arbitrary tokens guessed by an
    // attacker who somehow forged one (defense in depth — decryption
    // already validates integrity).
    const exists = await proxyUrlExists(proxyUrl);
    if (!exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // 4. Fetch + stream.
  //    Private store — the @vercel/blob `get()` helper authenticates
  //    with the server-side BLOB_READ_WRITE_TOKEN automatically. Plain
  //    `fetch(url)` would 401 against a private store.
  let blobResult;
  try {
    blobResult = await get(pathname, { access: "private" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[blob-proxy] upstream fetch failed", err);
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }
  if (!blobResult || !blobResult.stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Pass through headers that matter for rendering + caching.
  const headers = new Headers();
  const ct =
    blobResult.headers?.get("content-type") ??
    blobResult.blob?.contentType ??
    "application/octet-stream";
  headers.set("content-type", ct);
  const size = blobResult.blob?.size;
  if (typeof size === "number") headers.set("content-length", String(size));
  // Browser-side cache for a few minutes — content is immutable per
  // pathname (we never overwrite), so caching is safe. `private` keeps
  // shared caches/CDNs from storing it.
  headers.set("cache-control", "private, max-age=300");

  return new Response(blobResult.stream, { status: 200, headers });
}

/**
 * Search the three URL-bearing tables for a record where the given
 * proxy URL appears in any of the columns, AND where `userId` is the
 * owner. Returns true on first match.
 */
async function findOwningRecord(proxyUrl: string, userId: string): Promise<boolean> {
  const [vr, apc, suc] = await Promise.all([
    prisma.verificationRequest.findFirst({
      where: {
        userId,
        OR: [
          { studentIdUrl: proxyUrl },
          { proofUrl: proxyUrl },
          { rosterUrl: proxyUrl },
        ],
      },
      select: { id: true },
    }),
    prisma.athleteProgramConnection.findFirst({
      where: {
        userId,
        OR: [{ rosterUrl: proxyUrl }, { recruitingProofUrl: proxyUrl }],
      },
      select: { id: true },
    }),
    prisma.studentUniversityConnection.findFirst({
      where: {
        userId,
        OR: [{ studentIdUrl: proxyUrl }, { proofUrl: proxyUrl }],
      },
      select: { id: true },
    }),
  ]);
  return Boolean(vr || apc || suc);
}

/** Owner-agnostic version of findOwningRecord for the admin path. */
async function proxyUrlExists(proxyUrl: string): Promise<boolean> {
  const [vr, apc, suc] = await Promise.all([
    prisma.verificationRequest.findFirst({
      where: {
        OR: [
          { studentIdUrl: proxyUrl },
          { proofUrl: proxyUrl },
          { rosterUrl: proxyUrl },
        ],
      },
      select: { id: true },
    }),
    prisma.athleteProgramConnection.findFirst({
      where: { OR: [{ rosterUrl: proxyUrl }, { recruitingProofUrl: proxyUrl }] },
      select: { id: true },
    }),
    prisma.studentUniversityConnection.findFirst({
      where: { OR: [{ studentIdUrl: proxyUrl }, { proofUrl: proxyUrl }] },
      select: { id: true },
    }),
  ]);
  return Boolean(vr || apc || suc);
}
