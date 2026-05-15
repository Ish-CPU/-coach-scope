import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

/**
 * In-app notification creation helper.
 *
 * Append-only: this is the ONLY place application code creates
 * `Notification` rows. Callers from API routes wrap it in
 * `void createNotification(...)` so SMTP-style latency never blocks
 * the primary write.
 *
 * Self-action skip: when `actorId === userId` (e.g. a user upvotes
 * their own post via a future feature, or comments on their own
 * thread) we silently skip — no point pinging yourself.
 *
 * Never throws — failures are logged to console so the underlying
 * action they describe always succeeds.
 */
export interface CreateNotificationInput {
  /** Recipient — who sees this notification in their list. */
  userId: string;
  /** Optional actor — who triggered the event. Null for system events. */
  actorId?: string | null;
  type: NotificationType;
  /**
   * Polymorphic target. e.g. ("GroupPost", "<id>") for a reply,
   * ("Group", "<id>") for a group invite, undefined for global events.
   */
  subjectType?: string;
  subjectId?: string;
  /**
   * Free-form payload. Recipient-side renderers pull what they need.
   * Conventional keys we use today:
   *   - title       string  — the post / comment title for context
   *   - groupSlug   string  — for deep linking to the group page
   *   - groupName   string  — display label
   *   - voteDelta   number  — for POST_UPVOTE
   *   - actionLabel string  — for MOD_ACTION ("pinned", "removed", ...)
   */
  data?: Record<string, unknown>;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  if (!input.userId) return;
  if (input.actorId && input.actorId === input.userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        data: input.data ? (input.data as any) : undefined,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notifications] create failed", input.type, err);
  }
}

/**
 * Mark a single notification read for the signed-in user. Returns true
 * if a row matched + was updated, false otherwise. Cheap idempotent op.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count > 0;
}

/** Bulk mark every unread notification read for a user. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

/** Quick unread badge count — used by SiteHeader / nav. */
export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
