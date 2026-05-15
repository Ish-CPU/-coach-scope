import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { AdminStatus, UserRole } from "@prisma/client";

/**
 * POST /api/admin/onboarding
 *
 * Two modes:
 *   invite  — body: { mode: "invite", token, name, password }
 *             Looks up the invitee by inviteToken, verifies it's not
 *             expired, sets the password hash + name, marks them ACTIVE
 *             with acceptedAdminRulesAt.
 *
 *   session — body: { mode: "session", name, password? }
 *             Already-signed-in admin (e.g. used a temp password). Updates
 *             name + optionally password and marks them ACTIVE / accepted.
 *
 * Either way the user emerges as ACTIVE with acceptedAdminRulesAt set so
 * the staff layout stops redirecting them.
 */

const schema = z.object({
  mode: z.enum(["invite", "session"]),
  token: z.string().min(10).max(200).optional(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128).optional(),
});

export async function POST(req: Request) {
  // Loose burst protection — onboarding shouldn't be hammered.
  const limited = rateLimit(req, "admin:onboarding", {
    max: 10,
    windowMs: 10 * 60_000,
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
  const data = parsed.data;

  if (data.mode === "invite") {
    if (!data.token) {
      return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
    }
    if (!data.password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const invitee = await prisma.user.findUnique({
      where: { inviteToken: data.token },
      select: {
        id: true,
        role: true,
        adminStatus: true,
        inviteExpiresAt: true,
      },
    });
    if (
      !invitee ||
      invitee.role !== UserRole.ADMIN ||
      !invitee.inviteExpiresAt ||
      invitee.inviteExpiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: "Invite is invalid or expired." },
        { status: 400 }
      );
    }
    // Any blocking status (DISABLED / SUSPENDED / REMOVED) hard-rejects
    // the invite — even if the token is valid, we won't let the row
    // resurrect itself out from under a master admin's revocation.
    if (
      invitee.adminStatus === AdminStatus.DISABLED ||
      invitee.adminStatus === AdminStatus.SUSPENDED ||
      invitee.adminStatus === AdminStatus.REMOVED
    ) {
      return NextResponse.json(
        { error: "This invite is no longer active. Contact a master admin." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.user.update({
      where: { id: invitee.id },
      data: {
        name: data.name,
        passwordHash,
        adminStatus: AdminStatus.ACTIVE,
        acceptedAdminRulesAt: new Date(),
        // Persist both the timestamp + the boolean. The staff layout reads
        // either as "done" so legacy rows keep working, but new rows get
        // the cheaper boolean check.
        onboardingCompleted: true,
        // Single-use token: clear so it can't be replayed.
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return NextResponse.json({ ok: true, redirectTo: "/admin/dashboard" });
  }

  // session mode — must already be signed in as an admin.
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, adminStatus: true },
  });
  if (!me || (me.role !== UserRole.ADMIN && me.role !== UserRole.MASTER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Mirror the invite-mode guard: a blocked admin cannot self-onboard.
  if (
    me.adminStatus === AdminStatus.DISABLED ||
    me.adminStatus === AdminStatus.SUSPENDED ||
    me.adminStatus === AdminStatus.REMOVED
  ) {
    return NextResponse.json(
      { error: "This account no longer has access. Contact a master admin." },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {
    name: data.name,
    acceptedAdminRulesAt: new Date(),
    onboardingCompleted: true,
  };
  if (me.adminStatus === AdminStatus.INVITED) {
    updates.adminStatus = AdminStatus.ACTIVE;
  }
  if (data.password) {
    updates.passwordHash = await bcrypt.hash(data.password, 10);
    // Successful explicit reset — clear any leftover invite plumbing.
    updates.inviteToken = null;
    updates.inviteExpiresAt = null;
  }

  await prisma.user.update({
    where: { id: me.id },
    data: updates,
  });

  return NextResponse.json({ ok: true, redirectTo: "/admin/dashboard" });
}
