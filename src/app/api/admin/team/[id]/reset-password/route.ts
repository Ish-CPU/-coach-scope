import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canManageAdmins } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { AdminStatus, UserRole } from "@prisma/client";

/**
 * POST /api/admin/team/[id]/reset-password
 *
 * Master-only. Generates a fresh temporary password for the target admin,
 * hashes it, and returns the plaintext exactly once so the master can copy
 * + share it. Also clears acceptedAdminRulesAt so the user is forced through
 * onboarding again on next login.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canManageAdmins(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, adminStatus: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "Reset password from /admin/settings for the master admin." },
      { status: 400 }
    );
  }
  if (target.adminStatus === AdminStatus.REMOVED) {
    return NextResponse.json(
      {
        error:
          "Cannot reset password for a removed admin. Reactivate the account first.",
      },
      { status: 400 }
    );
  }

  const temporaryPassword = randomBytes(13).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      // Force a fresh acceptance of admin rules and invalidate any pending
      // invite token (a reset supersedes a stale invite).
      acceptedAdminRulesAt: null,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action: AUDIT_ACTIONS.ADMIN_PASSWORD_RESET,
    targetType: "User",
    targetId: target.id,
  });

  return NextResponse.json({ ok: true, temporaryPassword });
}
