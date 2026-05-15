import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import {
  canManageAdmins,
  normalizePermissions,
} from "@/lib/admin-permissions";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { sendAdminAlertEmail } from "@/lib/email/notifications";
import { AdminStatus, UserRole } from "@prisma/client";

/**
 * Admin team management — master-only.
 *
 *   GET  /api/admin/team        — list every admin/master row
 *   POST /api/admin/team        — invite a new staff admin (mode: invite | password)
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  workEmail: z.string().email().max(254).optional().nullable(),
  mode: z.enum(["invite", "password"]),
  permissions: z.record(z.boolean()).optional(),
});

const INVITE_TTL_DAYS = 14;

function publicBaseUrl(req: Request): string {
  // Prefer the request's own origin so dev and preview environments work
  // without extra config. Fall back to NEXTAUTH_URL.
  return new URL(req.url).origin || process.env.NEXTAUTH_URL || "";
}

function generateTempPassword(): string {
  // 18 url-safe characters — long enough that brute force isn't a concern
  // before the admin completes onboarding and overrides it.
  return randomBytes(13).toString("base64url");
}

function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET() {
  const session = await getSession();
  if (!canManageAdmins(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admins = await prisma.user.findMany({
    where: { role: { in: [UserRole.ADMIN, UserRole.MASTER_ADMIN] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      workEmail: true,
      role: true,
      adminStatus: true,
      lastLoginAt: true,
      createdAt: true,
      acceptedAdminRulesAt: true,
    },
  });
  return NextResponse.json({ admins });
}

export async function POST(req: Request) {
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();

  // Reject duplicates outright. We don't auto-promote existing accounts —
  // the master admin should do that explicitly via /admin/team/[id].
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists. Promote them from the team detail page instead." },
      { status: 409 }
    );
  }

  const permissions = normalizePermissions(data.permissions ?? {});
  // Hard-strip canManageAdmins — only MASTER_ADMIN gets that, never staff.
  permissions.canManageAdmins = false;

  // Two onboarding modes:
  //   invite   → no password set; user finishes via /admin/onboarding?token=…
  //   password → temp password generated; user signs in with it then
  //              completes /admin/onboarding to accept the rules.
  let inviteToken: string | null = null;
  let inviteExpiresAt: Date | null = null;
  let passwordHash: string | null = null;
  let temporaryPassword: string | undefined;

  if (data.mode === "invite") {
    inviteToken = generateInviteToken();
    inviteExpiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60_000);
  } else {
    temporaryPassword = generateTempPassword();
    passwordHash = await bcrypt.hash(temporaryPassword, 10);
  }

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email,
      workEmail: data.workEmail || null,
      role: UserRole.ADMIN,
      adminStatus: AdminStatus.INVITED,
      adminPermissions: permissions as any,
      passwordHash,
      inviteToken,
      inviteExpiresAt,
      // Force them through the onboarding flow to actively accept the rules.
      acceptedAdminRulesAt: null,
    },
    select: { id: true, email: true },
  });

  await logAdminAction({
    actorUserId: session!.user.id,
    action: AUDIT_ACTIONS.ADMIN_CREATED,
    targetType: "User",
    targetId: created.id,
    metadata: {
      email: created.email,
      mode: data.mode,
      permissions,
    },
  });

  void sendAdminAlertEmail({
    event: "invited",
    subjectName: data.name,
    subjectEmail: created.email,
    actorName: session!.user.name ?? session!.user.email ?? null,
    reason: `Invited via ${data.mode} mode`,
  });

  const inviteUrl = inviteToken
    ? `${publicBaseUrl(req)}/admin/onboarding?token=${inviteToken}`
    : undefined;

  return NextResponse.json(
    {
      id: created.id,
      email: created.email,
      inviteUrl,
      temporaryPassword,
    },
    { status: 201 }
  );
}
