import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canModerateReviews } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { ReviewModerationStatus, ReviewStatus } from "@prisma/client";

/**
 * POST /api/admin/reviews/[id]
 *   { action: "approve" | "remove" | "mark_safe" | "needs_more_info" }
 *
 * Moderation queue actions for a single Review row. Master + staff
 * admins with `canModerateReviews` only.
 *
 *   approve         — sets moderationStatus=PUBLISHED, status=PUBLISHED.
 *                     Used to release a PENDING_REVIEW row to the
 *                     public after human review.
 *   mark_safe       — same outcome as approve, distinct audit action so
 *                     we can tell "explicitly cleared" from "auto-passed".
 *   needs_more_info — keeps moderationStatus=PENDING_REVIEW but bumps
 *                     `credibilityReason` with the admin note. The
 *                     submitter sees nothing change publicly; useful when
 *                     an admin wants to defer.
 *   remove          — sets moderationStatus=REMOVED + status=REMOVED.
 *                     Terminal.
 */
const schema = z.object({
  action: z.enum(["approve", "remove", "mark_safe", "needs_more_info"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canModerateReviews(session)) {
    return NextResponse.json(
      { error: "You don't have permission to moderate reviews." },
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
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { action, note } = parsed.data;

  const review = await prisma.review.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      authorId: true,
      moderationStatus: true,
      credibilityReason: true,
    },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  let nextModeration: ReviewModerationStatus = review.moderationStatus;
  let nextStatus: ReviewStatus | null = null;
  let auditAction: string;
  switch (action) {
    case "approve":
    case "mark_safe":
      nextModeration = ReviewModerationStatus.PUBLISHED;
      nextStatus = ReviewStatus.PUBLISHED;
      auditAction = AUDIT_ACTIONS.REVIEW_APPROVED;
      break;
    case "remove":
      nextModeration = ReviewModerationStatus.REMOVED;
      nextStatus = ReviewStatus.REMOVED;
      auditAction = AUDIT_ACTIONS.REVIEW_REMOVED;
      break;
    case "needs_more_info":
    default:
      // Stay in PENDING_REVIEW; we just log a note for the next reviewer.
      auditAction = AUDIT_ACTIONS.REVIEW_NEEDS_MORE_INFO;
      break;
  }

  // Append the admin note to credibilityReason so the moderation
  // history stays attached to the row (not just in the audit log).
  const reasonsArray = Array.isArray(review.credibilityReason)
    ? (review.credibilityReason as unknown[])
    : [];
  const nextReasons = note
    ? [
        ...reasonsArray,
        {
          key: "admin_note",
          weight: 0,
          applied: true,
          note: `[${action}] ${note}`,
        },
      ]
    : reasonsArray;

  await prisma.review.update({
    where: { id: review.id },
    data: {
      moderationStatus: nextModeration,
      ...(nextStatus ? { status: nextStatus } : {}),
      credibilityReason: nextReasons as any,
    },
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action: auditAction as any,
    targetType: "Review",
    targetId: review.id,
    metadata: {
      action,
      note: note ?? null,
      from: review.moderationStatus,
      to: nextModeration,
      authorId: review.authorId,
    },
  });

  return NextResponse.json({ ok: true, moderationStatus: nextModeration });
}
