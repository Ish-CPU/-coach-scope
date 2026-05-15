import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canManageAdmins } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { revokeUserSessions } from "@/lib/session-revoke";
import { sendAdminAlertEmail } from "@/lib/email/notifications";
import { UserRole } from "@prisma/client";

/**
 * POST /api/admin/team/[id]/force-logout
 *
 * Master-only. Bumps the target's `sessionsRevokedAt` so every JWT issued
 * before now is treated as signed out on the next request. Doesn't touch
 * `adminStatus` — useful for "active admin, kick their session anyway"
 * (e.g. they left a public terminal signed in).
 *
 * Refuses to force-logout MASTER_ADMIN rows; the master must do that
 * themselves from the settings page.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canManageAdmins(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === UserRole.MASTER_ADMIN) {
    return NextResponse.json(
      { error: "Force-logout for master admin is managed from /admin/settings." },
      { status: 400 }
    );
  }
  if (target.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "Force-logout is only for admin accounts." },
      { status: 400 }
    );
  }

  await revokeUserSessions(target.id);

  await logAdminAction({
    actorUserId: session!.user.id,
    action: AUDIT_ACTIONS.ADMIN_FORCE_LOGOUT,
    targetType: "User",
    targetId: target.id,
  });

  void sendAdminAlertEmail({
    event: "force_logout",
    subjectName: target.name,
    subjectEmail: target.email,
    actorName: session!.user.name ?? session!.user.email ?? null,
  });

  return NextResponse.json({ ok: true });
}
