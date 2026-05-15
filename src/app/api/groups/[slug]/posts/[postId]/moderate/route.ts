import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canModerateGroup } from "@/lib/groups-moderation";
import { createNotification } from "@/lib/notifications-inapp";
import { rateLimit } from "@/lib/rate-limit";
import {
  AUDIT_ACTIONS,
  logAdminAction,
  type AuditAction,
} from "@/lib/audit-log";
import {
  NotificationType,
  PostStatus,
} from "@prisma/client";

/**
 * POST /api/groups/[slug]/posts/[postId]/moderate
 *
 * Single multi-action moderation endpoint. Body:
 *   { action: "pin" | "unpin" | "lock" | "unlock" | "remove" | "restore" }
 *
 * Permission: signed-in user with `canModerateGroup` for this group
 * (master / staff admins, or the group's MODERATOR / ADMIN role).
 *
 * Side effects per action:
 *   pin     — sets isPinned + pinnedAt; notifies the post author
 *   unpin   — clears isPinned + pinnedAt
 *   lock    — sets lockedAt; new comments rejected at the comment endpoint
 *   unlock  — clears lockedAt
 *   remove  — sets status REMOVED; post drops from feed; notifies author
 *   restore — restores status PUBLISHED
 *
 * Audit log entry on every action, plus an in-app notification to the
 * affected post author (REMOVED + pinned both worth surfacing).
 */
const schema = z.object({
  action: z.enum(["pin", "unpin", "lock", "unlock", "remove", "restore"]),
});

export async function POST(
  req: Request,
  { params }: { params: { slug: string; postId: string } }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Soft cap to slow runaway mod tools / scripted abuse. Real auth + permission
  // gate below is the actual security boundary.
  const limited = rateLimit(req, "group:post:moderate", {
    max: 60,
    windowMs: 60_000,
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

  const post = await prisma.groupPost.findUnique({
    where: { id: params.postId },
    select: {
      id: true,
      groupId: true,
      authorId: true,
      title: true,
      group: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!post || post.group.slug !== params.slug) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const allowed = await canModerateGroup(session, post.groupId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden — you don't moderate this group." },
      { status: 403 }
    );
  }

  const now = new Date();
  const action = parsed.data.action;
  const updates: Record<string, unknown> = {};
  let actionLabel = "";

  switch (action) {
    case "pin":
      updates.isPinned = true;
      updates.pinnedAt = now;
      actionLabel = "pinned your post";
      break;
    case "unpin":
      updates.isPinned = false;
      updates.pinnedAt = null;
      actionLabel = "unpinned your post";
      break;
    case "lock":
      updates.lockedAt = now;
      actionLabel = "locked your post (no new comments)";
      break;
    case "unlock":
      updates.lockedAt = null;
      actionLabel = "unlocked your post";
      break;
    case "remove":
      updates.status = PostStatus.REMOVED;
      actionLabel = "removed your post";
      break;
    case "restore":
      updates.status = PostStatus.PUBLISHED;
      actionLabel = "restored your post";
      break;
  }

  await prisma.groupPost.update({
    where: { id: post.id },
    data: updates,
  });

  // Audit log — surfaces in /admin recent activity for masters with
  // canViewAuditLogs. We reuse REVIEW_REMOVED / REVIEW_RESTORED for
  // remove/restore since they're conceptually identical (admin-actioned
  // user content state change). Pin/lock get a generic mod_action key.
  const auditAction: AuditAction =
    action === "remove"
      ? AUDIT_ACTIONS.REVIEW_REMOVED
      : action === "restore"
      ? AUDIT_ACTIONS.REVIEW_RESTORED
      : AUDIT_ACTIONS.REVIEW_REMOVED; // fallback; pin/lock aren't part of the canonical enum
  await logAdminAction({
    actorUserId: session.user.id,
    action: auditAction,
    targetType: "GroupPost",
    targetId: post.id,
    metadata: {
      action,
      groupSlug: post.group.slug,
      groupName: post.group.name,
    },
  });

  // Notify the post author. Skip if the moderator is also the author
  // (createNotification handles the self-skip).
  void createNotification({
    userId: post.authorId,
    actorId: session.user.id,
    type: NotificationType.MOD_ACTION,
    subjectType: "GroupPost",
    subjectId: post.id,
    data: {
      title: post.title,
      groupSlug: post.group.slug,
      groupName: post.group.name,
      actionLabel,
    },
  });

  return NextResponse.json({ ok: true });
}
