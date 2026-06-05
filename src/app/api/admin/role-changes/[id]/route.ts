/**
 * POST /api/admin/role-changes/[id]
 *
 * Admin action endpoint for the role-change queue. Body shape:
 *   { action: "approve" | "reject", adminNote?: string }
 *
 * Permission: `canApproveVerifications` — role changes are conceptually
 * "re-verify under a new role," so they share the verification approver
 * skill rather than introducing a separate permission flag. Same gate
 * the verification queue uses.
 *
 * Approve flow (single transaction):
 *   1. Re-read the request row. Refuse if not PENDING (someone else may
 *      have just acted; we return 409 so the UI refreshes cleanly).
 *   2. Re-read the user. Refuse if their role drifted away from the
 *      currentRole snapshot — likely an admin already fixed them
 *      manually and the request is stale.
 *   3. Flip user.role → requestedRole + verificationStatus → NONE
 *      (the user must re-prove identity under the new role).
 *   4. Mark the request APPROVED with adminNote + resolver + timestamp.
 *
 * Reject flow: mark REJECTED, store adminNote. User keeps their current
 * role unchanged.
 *
 * Audit log: ROLE_CHANGE_APPROVED / ROLE_CHANGE_REJECTED. Both carry
 * before/after role + adminNote so the trail explains the decision.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveVerifications } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { RequestStatus, VerificationStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canApproveVerifications(session)) {
    return NextResponse.json(
      { error: "You don't have permission to act on role-change requests." },
      { status: 403 }
    );
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { action, adminNote } = parsed.data;

  const request = await prisma.roleChangeRequest.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      currentRole: true,
      requestedRole: true,
      status: true,
    },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== RequestStatus.PENDING) {
    return NextResponse.json(
      {
        error:
          "This request was already resolved. Refresh the queue to see the latest state.",
        code: "already_resolved",
      },
      { status: 409 }
    );
  }

  const adminId = session!.user.id;
  const resolvedAt = new Date();

  if (action === "reject") {
    await prisma.roleChangeRequest.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.REJECTED,
        adminNote: adminNote ?? null,
        resolvedAt,
        resolvedById: adminId,
      },
    });

    await logAdminAction({
      actorUserId: adminId,
      action: AUDIT_ACTIONS.ROLE_CHANGE_REJECTED,
      targetType: "RoleChangeRequest",
      targetId: request.id,
      metadata: {
        userId: request.userId,
        currentRole: request.currentRole,
        requestedRole: request.requestedRole,
        adminNote: adminNote ?? null,
      },
    });

    return NextResponse.json({ ok: true, status: RequestStatus.REJECTED });
  }

  // Approve — single transaction so we never get a half-applied state
  // (user.role updated but request still PENDING, or vice versa).
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { id: true, role: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Drift check — refuse if the user's current role no longer matches
  // the snapshot. Likely an admin already adjusted them manually; bouncing
  // the action prevents silently overwriting that change.
  if (user.role !== request.currentRole) {
    return NextResponse.json(
      {
        error:
          "This user's role has changed since the request was filed. Reject and ask them to resubmit.",
        code: "role_drift",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: request.requestedRole,
        // New role → new proof. The user goes through verification again
        // for the new identity claim. Keeps the verified badge honest.
        verificationStatus: VerificationStatus.NONE,
      },
    }),
    prisma.roleChangeRequest.update({
      where: { id: request.id },
      data: {
        status: RequestStatus.APPROVED,
        adminNote: adminNote ?? null,
        resolvedAt,
        resolvedById: adminId,
      },
    }),
  ]);

  await logAdminAction({
    actorUserId: adminId,
    action: AUDIT_ACTIONS.ROLE_CHANGE_APPROVED,
    targetType: "RoleChangeRequest",
    targetId: request.id,
    metadata: {
      userId: user.id,
      email: user.email,
      previousRole: request.currentRole,
      newRole: request.requestedRole,
      adminNote: adminNote ?? null,
    },
  });

  return NextResponse.json({ ok: true, status: RequestStatus.APPROVED });
}
