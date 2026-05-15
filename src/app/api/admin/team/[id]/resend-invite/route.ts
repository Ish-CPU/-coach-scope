import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canManageAdmins } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { AdminStatus, UserRole } from "@prisma/client";

const INVITE_TTL_DAYS = 14;

/**
 * POST /api/admin/team/[id]/resend-invite
 *
 * Master-only. Generates a new single-use invite token, replaces any prior
 * token, and returns the full invite URL so the master can copy + share it
 * out-of-band. Also clears the password and acceptance timestamp so the
 * user is forced fully through onboarding.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!canManageAdmins(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, role: true, adminStatus: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "Invite is only for staff admin accounts." },
      { status: 400 }
    );
  }
  // Removed admins are archived — re-inviting them would defeat the point.
  // Master must reactivate (status → ACTIVE/INVITED) first.
  if (target.adminStatus === AdminStatus.REMOVED) {
    return NextResponse.json(
      {
        error:
          "Cannot resend invite to a removed admin. Reactivate the account first or invite a new admin.",
      },
      { status: 400 }
    );
  }

  const inviteToken = randomBytes(24).toString("base64url");
  const inviteExpiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60_000);

  await prisma.user.update({
    where: { id: target.id },
    data: {
      inviteToken,
      inviteExpiresAt,
      passwordHash: null, // force them to set a new password via onboarding
      acceptedAdminRulesAt: null,
      // If the row was DISABLED, leave that alone — master should re-enable
      // explicitly via PATCH. Otherwise reset to INVITED so the team list
      // shows the right state.
      adminStatus:
        target.adminStatus === AdminStatus.DISABLED
          ? AdminStatus.DISABLED
          : AdminStatus.INVITED,
    },
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action: AUDIT_ACTIONS.ADMIN_INVITE_RESENT,
    targetType: "User",
    targetId: target.id,
  });

  const origin = new URL(req.url).origin || process.env.NEXTAUTH_URL || "";
  const inviteUrl = `${origin}/admin/onboarding?token=${inviteToken}`;

  return NextResponse.json({ ok: true, inviteUrl });
}
