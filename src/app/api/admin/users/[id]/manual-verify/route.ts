/**
 * POST /api/admin/users/[id]/manual-verify
 *
 * Admin shortcut: flips a user's verificationStatus → VERIFIED without
 * requiring them to submit a verification request. Built for two cases:
 *   1. Paying customers caught by the old broken verification flow
 *      (stuck in PENDING with zero requests) — getting them re-submitted
 *      proof would be friction; if you vouch for them, just verify.
 *   2. Verified athletes you know personally (your teammates) where
 *      you don't need a proof round-trip.
 *
 * Permissions: same gate as the verification queue
 * (canApproveVerifications) — so staff admins with that perm bit OR a
 * master admin can use it. Audit-logged with a distinct event key so
 * the trail makes clear this was an admin override, not a normal queue
 * approval.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveVerifications } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { UserRole, VerificationStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canApproveVerifications(session)) {
    return NextResponse.json(
      { error: "You don't have permission to verify users." },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      verificationStatus: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Don't let an admin "verify" themselves or another admin via this
  // endpoint — admin status is managed elsewhere.
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) {
    return NextResponse.json(
      { error: "Cannot manually verify admin accounts." },
      { status: 400 }
    );
  }

  // VIEWER users don't have a role to verify (they're spectators). If
  // someone needs to be verified, they should be promoted to a
  // participation role first via the role-switch flow.
  if (user.role === UserRole.VIEWER) {
    return NextResponse.json(
      {
        error:
          "User is in the free 'Other' role. Promote them to a verified role first.",
      },
      { status: 400 }
    );
  }

  // Idempotent — no-op if already verified, return success either way so
  // the UI converges on the same state regardless of double-click.
  if (user.verificationStatus === VerificationStatus.VERIFIED) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationStatus: VerificationStatus.VERIFIED },
  });

  // Use the existing VERIFICATION_APPROVED audit key, with metadata
  // making clear this was a manual admin override (no
  // VerificationRequest involved).
  await logAdminAction({
    actorUserId: session!.user.id,
    action: AUDIT_ACTIONS.VERIFICATION_APPROVED,
    targetType: "User",
    targetId: user.id,
    metadata: {
      manualOverride: true,
      previousStatus: user.verificationStatus,
      role: user.role,
      email: user.email,
      reason: "admin_members_page_manual_verify",
    },
  });

  return NextResponse.json({ ok: true });
}
