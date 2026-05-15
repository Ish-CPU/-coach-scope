import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import {
  canManageAdmins,
  isBlockingAdminStatus,
  normalizePermissions,
  NO_PERMISSIONS,
} from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction, type AuditAction } from "@/lib/audit-log";
import { revokeUserSessions } from "@/lib/session-revoke";
import {
  sendAdminAlertEmail,
  type AdminLifecycleEvent,
} from "@/lib/email/notifications";
import { AdminRemovalReason, AdminStatus, UserRole } from "@prisma/client";

/**
 * PATCH /api/admin/team/[id]
 *
 * Master-only. Updates one or more of:
 *   - status (INVITED / ACTIVE / DISABLED / SUSPENDED / REMOVED)
 *   - permissions (granular flags JSON)
 *   - workEmail
 *   - removalReason / removalNote (only meaningful for blocking statuses)
 *
 * Side effects:
 *   - Moving status into a blocking state (DISABLED / SUSPENDED / REMOVED)
 *     zeroes permissions defensively AND revokes every active session.
 *   - REMOVED is the terminal soft-archive — the row is preserved so audit
 *     history and historical `reviewedBy` references remain valid.
 *
 * Master admin rows are read-only here; settings live at /admin/settings
 * and a master cannot disable themselves via the team API.
 */

const patchSchema = z.object({
  status: z.nativeEnum(AdminStatus).optional(),
  permissions: z.record(z.boolean()).optional(),
  workEmail: z.string().email().max(254).nullable().optional(),
  removalReason: z.nativeEnum(AdminRemovalReason).nullable().optional(),
  removalNote: z.string().trim().max(2000).nullable().optional(),
});

// Map the new status to the audit action. Reactivation (back to ACTIVE)
// is its own event so the master can scan a single timeline.
function statusAuditAction(next: AdminStatus): AuditAction | null {
  switch (next) {
    case AdminStatus.DISABLED:
      return AUDIT_ACTIONS.ADMIN_DISABLED;
    case AdminStatus.SUSPENDED:
      return AUDIT_ACTIONS.ADMIN_SUSPENDED;
    case AdminStatus.REMOVED:
      return AUDIT_ACTIONS.ADMIN_REMOVED;
    case AdminStatus.ACTIVE:
      return AUDIT_ACTIONS.ADMIN_REENABLED;
    default:
      return null;
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canManageAdmins(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminStatus: true,
      adminPermissions: true,
      workEmail: true,
      removalReason: true,
      removalNote: true,
    },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Master admin rows can't be edited via this endpoint — protect against
  // a master disabling themselves and locking the deployment out, and
  // honor the spec's "ADMIN cannot disable MASTER_ADMIN" rule (this whole
  // endpoint is master-gated, but extra defense in depth never hurts).
  if (target.role === UserRole.MASTER_ADMIN) {
    return NextResponse.json(
      { error: "Master admin row is managed from /admin/settings, not here." },
      { status: 400 }
    );
  }
  if (target.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Target is not an admin." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const oldPerms = normalizePermissions(target.adminPermissions);
  let nextPerms = oldPerms;
  const newStatus = data.status ?? target.adminStatus;
  const isMovingToBlocking =
    !!data.status &&
    isBlockingAdminStatus(data.status) &&
    target.adminStatus !== data.status;

  if (data.workEmail !== undefined) {
    updates.workEmail = data.workEmail || null;
  }

  if (data.permissions) {
    nextPerms = normalizePermissions(data.permissions);
    nextPerms.canManageAdmins = false; // never grant manage-admins to staff
    updates.adminPermissions = nextPerms as any;
  }

  if (data.status && data.status !== target.adminStatus) {
    updates.adminStatus = data.status;
    // Blocking statuses defensively zero permissions so the JWT can't
    // briefly serve stale grants while it refetches. Reactivation (ACTIVE)
    // restores whatever permissions were sent in the same PATCH.
    if (isBlockingAdminStatus(data.status)) {
      nextPerms = { ...NO_PERMISSIONS };
      updates.adminPermissions = nextPerms as any;
    }
  }

  // Removal reason / note. Only persisted when the resulting status is a
  // blocking one — otherwise we clear them so old reasons don't follow a
  // user back into ACTIVE.
  if (newStatus && isBlockingAdminStatus(newStatus)) {
    if (data.removalReason !== undefined) updates.removalReason = data.removalReason;
    if (data.removalNote !== undefined) {
      updates.removalNote = data.removalNote ? data.removalNote.trim() : null;
    }
  } else if (data.status && data.status === AdminStatus.ACTIVE) {
    // Reactivating clears any prior removal context.
    updates.removalReason = null;
    updates.removalNote = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  await prisma.user.update({
    where: { id: target.id },
    data: updates,
  });

  // Immediate session revocation when transitioning to a blocking state.
  // The JWT callback also enforces this on next request, but explicitly
  // bumping `sessionsRevokedAt` here means the very first post-transition
  // request from the affected user fails out.
  if (isMovingToBlocking) {
    await revokeUserSessions(target.id);
  }

  // Emit one audit row per logical change so the activity log is granular.
  if (data.status && data.status !== target.adminStatus) {
    const action = statusAuditAction(data.status);
    if (action) {
      await logAdminAction({
        actorUserId: session!.user.id,
        action,
        targetType: "User",
        targetId: target.id,
        metadata: {
          from: target.adminStatus,
          to: data.status,
          reason: updates.removalReason ?? null,
          note: updates.removalNote ?? null,
          sessionsRevoked: isMovingToBlocking,
        },
      });
    }

    // Master-admin email alert for every lifecycle change. Master is
    // always opted in; staff admins receive these only if they have the
    // `admin_lifecycle` notification preference left at default (true).
    const emailEvent = statusEmailEvent(data.status);
    if (emailEvent) {
      void sendAdminAlertEmail({
        event: emailEvent,
        subjectName: target.name,
        subjectEmail: target.email,
        actorName: session!.user.name ?? session!.user.email ?? null,
        reason:
          (updates.removalReason as string | null | undefined) ??
          (updates.removalNote as string | null | undefined) ??
          null,
      });
    }
  }
  if (data.permissions) {
    await logAdminAction({
      actorUserId: session!.user.id,
      action: AUDIT_ACTIONS.ADMIN_PERMISSIONS_CHANGED,
      targetType: "User",
      targetId: target.id,
      metadata: { before: oldPerms, after: nextPerms },
    });
  }

  return NextResponse.json({ ok: true, sessionsRevoked: isMovingToBlocking });
}

// Map a target AdminStatus to the email lifecycle event. INVITED has no
// matching email — the invite send happens at /api/admin/team POST when
// the row is first created, not on subsequent PATCHes back to INVITED.
function statusEmailEvent(next: AdminStatus): AdminLifecycleEvent | null {
  switch (next) {
    case AdminStatus.ACTIVE:
      return "activated";
    case AdminStatus.SUSPENDED:
      return "suspended";
    case AdminStatus.DISABLED:
      return "disabled";
    case AdminStatus.REMOVED:
      return "removed";
    default:
      return null;
  }
}
