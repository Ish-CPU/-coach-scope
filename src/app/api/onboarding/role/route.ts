import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { statusGrantsAccess } from "@/lib/subscription";
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
  const limited = await rateLimit(req, "onboarding:role", {
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

  // Read the user's CURRENT role + verification status + subscription
  // BEFORE deciding what to do. We need subscriptionStatus for the
  // paywall check below — never trust the session's copy (a user could
  // hold a stale JWT after cancellation).
  //
  // Previous bug here: this endpoint always reset `verificationStatus`
  // to NONE, so a verified user who re-visited /onboarding (history,
  // refresh, deep link) and re-picked the same role would silently
  // lose their VERIFIED state and be sent back through proof
  // submission. We now only reset on actual role change.
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, verificationStatus: true, subscriptionStatus: true },
  });
  if (!current) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // PAYWALL — close the "free signup → upgrade to ATHLETE" loophole.
  //
  // Until now this endpoint accepted any role in ALLOWED with no payment
  // check, so a user could:
  //   1. Pick "Other (free)" at /pricing → register as VIEWER
  //   2. Visit /onboarding and click "Athlete"
  //   3. Become VERIFIED_ATHLETE in the DB with $0 paid
  //
  // VIEWER is the free tier and stays unconditionally allowed. Any other
  // role requires a subscription that grants access — ACTIVE, TRIALING,
  // or CANCELED (cancelled-but-period-not-yet-elapsed). FREE, EXPIRED,
  // and PAST_DUE are rejected. We always allow re-picking the same role
  // (idempotent no-op) since that's just a UI refresh, not an upgrade.
  const isSameRole = current.role === role;
  if (
    role !== UserRole.VIEWER &&
    !isSameRole &&
    !statusGrantsAccess(current.subscriptionStatus)
  ) {
    return NextResponse.json(
      {
        error:
          "Pick a subscription before claiming a verified role. Visit /pricing to start your free trial.",
        code: "subscription_required",
      },
      { status: 402 }
    );
  }

  // Only reset verification if the role ACTUALLY changes. Same-role
  // re-pick is a no-op for verification — VERIFIED stays VERIFIED.
  // VIEWER additionally never has a verification flow so we set it to
  // NONE regardless (it's the canonical "no proof needed" state).
  const nextVerificationStatus =
    role === UserRole.VIEWER
      ? VerificationStatus.NONE
      : isSameRole
      ? current.verificationStatus
      : VerificationStatus.NONE;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { role, verificationStatus: nextVerificationStatus },
  });

  return NextResponse.json({ ok: true, role });
}
