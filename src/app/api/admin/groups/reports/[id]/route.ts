import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/permissions";
import { canModerateReviews } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { PostStatus, ReportStatus } from "@prisma/client";

/**
 * POST /api/admin/groups/reports/[id]
 *   { action: "remove" | "dismiss" }
 *
 * Action a single open Report against a group post or comment. Only
 * staff admins (canModerateReviews) can call. Mirrors the existing
 * /api/admin/reports/[id] endpoint but scoped to group content.
 *
 *   remove  — sets the post.status / comment.status to REMOVED and
 *             closes the report as RESOLVED.
 *   dismiss — closes the report as DISMISSED. The content is left
 *             alone (the report was bogus / already handled).
 */
const schema = z.object({
  action: z.enum(["remove", "dismiss"]),
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
      { error: "You don't have permission to moderate reports." },
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

  const report = await prisma.report.findUnique({
    where: { id: params.id },
    select: { id: true, postId: true, commentId: true, status: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (report.status !== ReportStatus.OPEN) {
    return NextResponse.json(
      { error: "Report is already resolved." },
      { status: 400 }
    );
  }

  const action = parsed.data.action;
  const now = new Date();

  if (action === "dismiss") {
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.DISMISSED,
        resolvedAt: now,
        resolvedBy: session!.user.id,
      },
    });
    await logAdminAction({
      actorUserId: session!.user.id,
      action: AUDIT_ACTIONS.REVIEW_RESTORED,
      targetType: report.postId ? "GroupPost" : "GroupComment",
      targetId: report.postId ?? report.commentId ?? undefined,
      metadata: { reportId: report.id, action: "dismiss" },
    });
    return NextResponse.json({ ok: true, action: "dismiss" });
  }

  // remove — flip the underlying content's status, then close the report.
  if (report.postId) {
    await prisma.$transaction([
      prisma.groupPost.update({
        where: { id: report.postId },
        data: { status: PostStatus.REMOVED },
      }),
      prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.RESOLVED,
          resolvedAt: now,
          resolvedBy: session!.user.id,
        },
      }),
    ]);
    await logAdminAction({
      actorUserId: session!.user.id,
      action: AUDIT_ACTIONS.REVIEW_REMOVED,
      targetType: "GroupPost",
      targetId: report.postId,
      metadata: { reportId: report.id, action: "remove" },
    });
  } else if (report.commentId) {
    await prisma.$transaction([
      prisma.groupComment.update({
        where: { id: report.commentId },
        data: { status: PostStatus.REMOVED },
      }),
      prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.RESOLVED,
          resolvedAt: now,
          resolvedBy: session!.user.id,
        },
      }),
    ]);
    await logAdminAction({
      actorUserId: session!.user.id,
      action: AUDIT_ACTIONS.REVIEW_REMOVED,
      targetType: "GroupComment",
      targetId: report.commentId,
      metadata: { reportId: report.id, action: "remove" },
    });
  } else {
    return NextResponse.json(
      { error: "Report has no group post or comment target." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, action: "remove" });
}
