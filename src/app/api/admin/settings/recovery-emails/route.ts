import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { isMasterAdmin } from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";

/**
 * GET / PUT /api/admin/settings/recovery-emails
 *
 * Master-only. The recovery email list is stored on the master's User row
 * and is used by the password reset flow as alternates. Staff admins
 * cannot read or write — explicit isMasterAdmin guard.
 */

const putSchema = z.object({
  emails: z.array(z.string().email().max(254)).max(5),
});

export async function GET() {
  const session = await getSession();
  if (!isMasterAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { recoveryEmails: true },
  });
  return NextResponse.json({ emails: me?.recoveryEmails ?? [] });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!isMasterAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Normalize: lowercase + de-dupe so the stored list is always canonical.
  const emails = Array.from(
    new Set(parsed.data.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  );

  const before = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { recoveryEmails: true },
  });

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { recoveryEmails: emails },
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action: AUDIT_ACTIONS.RECOVERY_EMAILS_UPDATED,
    targetType: "User",
    targetId: session!.user.id,
    metadata: { before: before?.recoveryEmails ?? [], after: emails },
  });

  return NextResponse.json({ ok: true, emails });
}
