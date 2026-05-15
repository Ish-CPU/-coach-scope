import { prisma } from "@/lib/prisma";

/**
 * Canonical action keys logged to AdminActionLog. Free string at the schema
 * layer for easy extension; this enum-style export gives callers IDE
 * autocomplete and one place to find every known action.
 */
export const AUDIT_ACTIONS = {
  ADMIN_CREATED: "admin.created",
  ADMIN_DISABLED: "admin.disabled",
  ADMIN_SUSPENDED: "admin.suspended",
  ADMIN_REMOVED: "admin.removed",
  ADMIN_REENABLED: "admin.reenabled",
  ADMIN_PERMISSIONS_CHANGED: "admin.permissions_changed",
  ADMIN_INVITE_RESENT: "admin.invite_resent",
  ADMIN_PASSWORD_RESET: "admin.password_reset",
  ADMIN_FORCE_LOGOUT: "admin.force_logout",
  RECOVERY_EMAILS_UPDATED: "settings.recovery_emails_updated",
  VERIFICATION_APPROVED: "verification.approved",
  VERIFICATION_REJECTED: "verification.rejected",
  VERIFICATION_NEEDS_MORE_INFO: "verification.needs_more_info",
  ATHLETE_CONNECTION_APPROVED: "connection.athlete.approved",
  ATHLETE_CONNECTION_REJECTED: "connection.athlete.rejected",
  STUDENT_CONNECTION_APPROVED: "connection.student.approved",
  STUDENT_CONNECTION_REJECTED: "connection.student.rejected",
  REVIEW_REMOVED: "review.removed",
  REVIEW_RESTORED: "review.restored",
  REVIEW_FLAGGED: "review.flagged",
  REVIEW_APPROVED: "review.approved",
  REVIEW_NEEDS_MORE_INFO: "review.needs_more_info",
  USER_REVIEW_BANNED: "user.review_banned",
  IMPORT_RUN: "import.run",
  // Email pipeline — every send writes one of these so we can audit
  // notification volume and chase silent failures.
  EMAIL_SENT: "email.sent",
  EMAIL_FAILED: "email.failed",
  // Fired when a single email address crosses the failed-sign-in threshold
  // (see src/lib/auth.ts). Targeted so the master admin can act.
  ADMIN_LOGIN_FAILURE_THRESHOLD: "admin.login_failure_threshold",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Append-only logger. Never throws — audit failures should not break the
 * underlying admin action they describe. Errors are written to console so
 * they're visible during dev.
 *
 * `actorUserId` may be null/empty for system-triggered events (email
 * pipeline, scheduled jobs). The schema column is nullable.
 */
export async function logAdminAction(input: {
  actorUserId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.adminActionLog.create({
      data: {
        actorUserId:
          input.actorUserId && input.actorUserId.length > 0
            ? input.actorUserId
            : null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit-log] failed to log", input.action, err);
  }
}
