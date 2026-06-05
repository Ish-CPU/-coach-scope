/**
 * POST /api/admin/dmca/[id]
 *
 * Admin action endpoint for DMCA notices. Body:
 *   {
 *     action: "remove_content" | "restore_content" | "reject",
 *     adminNote?: string,       (shown to submitter in decision email — TODO)
 *     actionTaken?: string,     (internal: "removed review abc123")
 *   }
 *
 * Permission: master admin only by default. DMCA disposition has
 * personal-liability implications for the platform owner, so we
 * don't delegate to staff admins unless explicitly granted. (Future:
 * add a `canActOnDmca` permission key if you grow a legal team.)
 *
 * State transitions enforced server-side:
 *   PENDING            → CONTENT_REMOVED (action=remove_content, kind=TAKEDOWN)
 *   PENDING            → REJECTED         (action=reject)
 *   CONTENT_REMOVED    → COUNTER_RECEIVED (auto-set when a counter-notice
 *                                          referencing this id is filed —
 *                                          but admins can also flip manually)
 *   COUNTER_RECEIVED   → CONTENT_RESTORED (action=restore_content,
 *                                          ONLY after counterEligibleToRestoreAt)
 *   Any → REJECTED                        (admin can always reject)
 *
 * The eligibility-date check on restoration is hard-enforced — § 512(g)
 * requires the waiting period and we don't let it be skipped, even by
 * a master admin clicking too eagerly.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { isMasterAdmin } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction, type AuditAction } from "@/lib/audit-log";
import { DmcaNoticeStatus, DmcaNoticeKind } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["remove_content", "restore_content", "reject"]),
  adminNote: z.string().trim().max(2000).optional(),
  actionTaken: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!isMasterAdmin(session)) {
    return NextResponse.json(
      { error: "Only the master admin can act on DMCA notices." },
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
  const { action, adminNote, actionTaken } = parsed.data;

  const notice = await prisma.dmcaNotice.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      status: true,
      counterEligibleToRestoreAt: true,
    },
  });
  if (!notice) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  }

  const adminId = session!.user.id;
  const now = new Date();

  let nextStatus: DmcaNoticeStatus;
  let auditAction: AuditAction;

  if (action === "reject") {
    nextStatus = DmcaNoticeStatus.REJECTED;
    auditAction = AUDIT_ACTIONS.DMCA_NOTICE_REJECTED;
  } else if (action === "remove_content") {
    if (notice.kind !== DmcaNoticeKind.TAKEDOWN) {
      return NextResponse.json(
        { error: "Counter-notices don't remove content. Use restore_content instead." },
        { status: 400 }
      );
    }
    if (notice.status !== DmcaNoticeStatus.PENDING) {
      return NextResponse.json(
        { error: "This notice has already been acted on." },
        { status: 409 }
      );
    }
    nextStatus = DmcaNoticeStatus.CONTENT_REMOVED;
    auditAction = AUDIT_ACTIONS.DMCA_CONTENT_REMOVED;
  } else {
    // restore_content
    if (notice.kind !== DmcaNoticeKind.COUNTER_NOTICE) {
      return NextResponse.json(
        { error: "Only counter-notices can restore content." },
        { status: 400 }
      );
    }
    // § 512(g) waiting period — HARD enforced. The minimum statutory
    // window must elapse before restoration; we don't let even a
    // master admin skip it to prevent inadvertent loss of safe harbor.
    if (
      notice.counterEligibleToRestoreAt &&
      notice.counterEligibleToRestoreAt > now
    ) {
      return NextResponse.json(
        {
          error: `Statutory waiting period not yet expired. Earliest restore: ${notice.counterEligibleToRestoreAt.toISOString()}`,
          code: "waiting_period_active",
          eligibleAt: notice.counterEligibleToRestoreAt.toISOString(),
        },
        { status: 409 }
      );
    }
    nextStatus = DmcaNoticeStatus.CONTENT_RESTORED;
    auditAction = AUDIT_ACTIONS.DMCA_CONTENT_RESTORED;
  }

  await prisma.dmcaNotice.update({
    where: { id: notice.id },
    data: {
      status: nextStatus,
      ...(adminNote !== undefined && { adminNote: adminNote || null }),
      ...(actionTaken !== undefined && { actionTaken: actionTaken || null }),
      resolvedAt: now,
      resolvedById: adminId,
    },
  });

  await logAdminAction({
    actorUserId: adminId,
    action: auditAction,
    targetType: "DmcaNotice",
    targetId: notice.id,
    metadata: {
      kind: notice.kind,
      previousStatus: notice.status,
      newStatus: nextStatus,
      adminNote: adminNote ?? null,
      actionTaken: actionTaken ?? null,
    },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
