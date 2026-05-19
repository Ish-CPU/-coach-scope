import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveVerifications } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import {
  UserRole,
  VerificationRequestStatus,
  VerificationStatus,
} from "@prisma/client";
import { applyVerificationApproval } from "@/lib/verification-approval";

const schema = z.object({
  // "needs_more_info" pings the user to add more evidence without
  // approving or rejecting outright. Their `verificationStatus` stays
  // PENDING so they keep a clear path back to /verification.
  action: z.enum(["approve", "reject", "needs_more_info"]),
  rejectionReason: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canApproveVerifications(session)) {
    return NextResponse.json(
      { error: "You don't have permission to action verification requests." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.verificationRequest.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const action = parsed.data.action;
  const approving = action === "approve";

  // Map admin action → request status + downstream user.verificationStatus.
  let nextRequestStatus: VerificationRequestStatus;
  let nextUserStatus: VerificationStatus;
  switch (action) {
    case "approve":
      nextRequestStatus = VerificationRequestStatus.APPROVED;
      nextUserStatus = VerificationStatus.VERIFIED;
      break;
    case "reject":
      nextRequestStatus = VerificationRequestStatus.REJECTED;
      nextUserStatus = VerificationStatus.REJECTED;
      break;
    case "needs_more_info":
    default:
      nextRequestStatus = VerificationRequestStatus.NEEDS_MORE_INFO;
      // Keep the user in PENDING so the verification page still routes them
      // through the right form to add more evidence.
      nextUserStatus = VerificationStatus.PENDING;
      break;
  }

  // Pre-compute `isUpgrade` only for the audit-log metadata below.
  // All the role-flip + auto-connect logic now lives in the shared
  // helper, which the auto-approval path also calls — keeps both
  // entry points in lockstep so a future change to "what happens on
  // approval" can't diverge between manual and auto.
  const isUpgrade =
    approving &&
    request.user.role === UserRole.VERIFIED_RECRUIT &&
    (request.targetRole === UserRole.VERIFIED_ATHLETE ||
      request.targetRole === UserRole.VERIFIED_ATHLETE_ALUMNI);

  await prisma.$transaction(async (tx) => {
    await tx.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: nextRequestStatus,
        reviewedAt: new Date(),
        reviewedBy: session!.user.id,
        // The "rejectionReason" column doubles as the admin note for
        // NEEDS_MORE_INFO so the user sees the same string back regardless
        // of which terminal-or-pending state they land in.
        rejectionReason: approving ? null : parsed.data.rejectionReason ?? null,
      },
    });

    if (approving) {
      // Role flip + review weight refresh + recruit upgrade auto-connect
      // all happen inside the helper. Pass the admin id as the actor so
      // the auto-connect's reviewedBy / note attributes the action to a
      // human rather than the multi-proof auto-approval path.
      await applyVerificationApproval(
        tx,
        {
          id: request.id,
          userId: request.userId,
          targetRole: request.targetRole,
          sport: request.sport,
          universityId: request.universityId,
          universityName: request.universityName,
          schoolId: request.schoolId,
          rosterUrl: request.rosterUrl,
          user: { role: request.user.role },
        },
        { actorUserId: session!.user.id }
      );
    } else {
      // Reject + needs_more_info paths only touch the user's
      // verificationStatus — role + connections are unchanged.
      await tx.user.update({
        where: { id: request.userId },
        data: { verificationStatus: nextUserStatus },
      });
    }
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action:
      action === "approve"
        ? AUDIT_ACTIONS.VERIFICATION_APPROVED
        : action === "reject"
        ? AUDIT_ACTIONS.VERIFICATION_REJECTED
        : AUDIT_ACTIONS.VERIFICATION_NEEDS_MORE_INFO,
    targetType: "VerificationRequest",
    targetId: request.id,
    metadata: {
      userId: request.userId,
      targetRole: request.targetRole,
      priorRole: request.user.role,
      isUpgrade,
      rejectionReason: parsed.data.rejectionReason ?? null,
      fraudStatus: request.fraudStatus ?? null,
      fraudScore: request.fraudScore ?? null,
    },
  });

  // Separately log an admin override entry when the admin's decision
  // diverged from the fraud model's recommendation. Helps us audit how
  // often humans approve REVIEW_REQUIRED rows (false-positive rate) and
  // how often they reject CLEAR rows (false-negative rate) — both feed
  // back into provider tuning. CLEAR + approve / DENIED + reject are
  // "agreement" cases and don't log.
  const fraud = request.fraudStatus;
  const overrideKind =
    fraud === "REVIEW_REQUIRED" && approving
      ? "approved_review_required"
      : fraud === "REVIEW_REQUIRED" && action === "reject"
        ? "rejected_review_required"
        : fraud === "CLEAR" && action === "reject"
          ? "rejected_clear"
          : null;
  if (overrideKind) {
    await logAdminAction({
      actorUserId: session!.user.id,
      action: AUDIT_ACTIONS.AI_FRAUD_ADMIN_OVERRIDE,
      targetType: "VerificationRequest",
      targetId: request.id,
      metadata: {
        userId: request.userId,
        overrideKind,
        fraudStatus: fraud,
        fraudScore: request.fraudScore ?? null,
        adminAction: action,
      },
    });
  }

  return NextResponse.json({ ok: true, status: nextRequestStatus, upgraded: isUpgrade });
}
