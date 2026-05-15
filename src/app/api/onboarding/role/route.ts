import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { UserRole, VerificationStatus } from "@prisma/client";

/**
 * Post-signup role selection. Updates `user.role` to one of the roles the
 * onboarding picker offers. Switching role also resets the user's
 * verification status to NONE so they go through the right proof flow next.
 *
 * Admins cannot demote themselves through this endpoint.
 */
const ALLOWED: Set<UserRole> = new Set([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_ATHLETE_ALUMNI,
  UserRole.VERIFIED_RECRUIT,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_STUDENT_ALUMNI,
  UserRole.VERIFIED_PARENT,
  UserRole.VIEWER,
]);

const schema = z.object({
  role: z.nativeEnum(UserRole),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // 10 role-change attempts per 10 min per user — well above any honest pace.
  const limited = rateLimit(req, "onboarding:role", {
    max: 10,
    windowMs: 10 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { role } = parsed.data;

  if (!ALLOWED.has(role)) {
    return NextResponse.json({ error: "Role not selectable from onboarding." }, { status: 400 });
  }

  // Never let an Admin be demoted by their own onboarding click — admin role
  // is set in the DB, not via UI.
  if (
    session.user.role === UserRole.ADMIN ||
    session.user.role === UserRole.MASTER_ADMIN
  ) {
    return NextResponse.json({ error: "Admin accounts can't change role here." }, { status: 403 });
  }

  // Reset verification when switching to a new participation role so the
  // user is routed to the correct proof flow. VIEWER doesn't need proof.
  const verificationStatus =
    role === UserRole.VIEWER ? VerificationStatus.NONE : VerificationStatus.NONE;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role, verificationStatus },
  });

  return NextResponse.json({ ok: true, role });
}
