/**
 * /api/account/role-change
 *
 * POST  — A signed-in user submits a request to switch their role
 *         (e.g. graduating from VERIFIED_ATHLETE to VERIFIED_ATHLETE_ALUMNI,
 *         or recruit-to-athlete on enrollment). The request lands in the
 *         admin queue at /admin/role-changes; nothing changes on the user
 *         until an admin approves.
 *
 * GET   — Returns this user's own request history (newest first), capped.
 *         Used by the /account/settings UI to render past + pending status.
 *
 * Gates at submit time:
 *   1. Must be signed in.
 *   2. Must have a participation-grade subscription (ACTIVE/TRIALING/
 *      CANCELED). The /api/onboarding/role paywall closes one door; this
 *      makes sure the queue can't be used as another way around it.
 *   3. Requested role must be one of the user-selectable verified roles.
 *      VIEWER (downgrade) and admin roles are never valid targets.
 *   4. Requested role must differ from the current role.
 *   5. User cannot have an existing PENDING request — they finish or
 *      withdraw the first one before opening another.
 *   6. Admin accounts (ADMIN / MASTER_ADMIN) cannot self-demote here.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { statusGrantsAccess } from "@/lib/subscription";
import { RequestStatus, UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Roles a user can request via this flow. Mirrors the onboarding picker
 *  but EXCLUDES VIEWER — switching to the free tier is a cancellation
 *  flow, not a role change — and admin roles. */
const REQUESTABLE: Set<UserRole> = new Set([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_ATHLETE_ALUMNI,
  UserRole.VERIFIED_RECRUIT,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_STUDENT_ALUMNI,
  UserRole.VERIFIED_PARENT,
]);

const submitSchema = z.object({
  requestedRole: z.nativeEnum(UserRole),
  reason: z.string().trim().min(10, "Tell us a bit about why").max(2000),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // 3 submits per hour per user — a real user submits one and waits.
  // Bots and confused-click loops bounce here.
  const limited = await rateLimit(req, "account:role-change", {
    max: 3,
    windowMs: 60 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { requestedRole, reason } = parsed.data;

  if (!REQUESTABLE.has(requestedRole)) {
    return NextResponse.json(
      {
        error:
          "That role can't be requested here. Pick one of the verified athlete / student / parent / recruit roles.",
      },
      { status: 400 }
    );
  }

  // Always read fresh state — never trust the session for permission
  // decisions (the JWT could be stale post-cancellation).
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, subscriptionStatus: true },
  });
  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (me.role === UserRole.ADMIN || me.role === UserRole.MASTER_ADMIN) {
    return NextResponse.json(
      { error: "Admin accounts can't change role through this flow." },
      { status: 403 }
    );
  }

  // Same paywall as /api/onboarding/role — only paying / trialing /
  // cancelled-but-still-current users can move to a verified role.
  if (!statusGrantsAccess(me.subscriptionStatus)) {
    return NextResponse.json(
      {
        error:
          "Start your free trial or subscribe before requesting a role change. Visit /pricing.",
        code: "subscription_required",
      },
      { status: 402 }
    );
  }

  if (me.role === requestedRole) {
    return NextResponse.json(
      { error: "You're already on that role." },
      { status: 400 }
    );
  }

  // One pending request at a time. Forces serial review, prevents queue
  // spam, and keeps the user's history page readable.
  const existingPending = await prisma.roleChangeRequest.findFirst({
    where: { userId: session.user.id, status: RequestStatus.PENDING },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json(
      {
        error:
          "You already have a pending role change request. Wait for it to be reviewed or withdraw it before opening a new one.",
        code: "already_pending",
      },
      { status: 409 }
    );
  }

  const created = await prisma.roleChangeRequest.create({
    data: {
      userId: session.user.id,
      currentRole: me.role,
      requestedRole,
      reason,
      status: RequestStatus.PENDING,
    },
    select: { id: true, status: true, createdAt: true },
  });

  return NextResponse.json(
    { id: created.id, status: created.status, createdAt: created.createdAt },
    { status: 201 }
  );
}

export async function GET(_req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // 20 is plenty for a single user's history — they'll see the most
  // recent in the UI and rarely need more.
  const requests = await prisma.roleChangeRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      currentRole: true,
      requestedRole: true,
      reason: true,
      status: true,
      adminNote: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  return NextResponse.json({ requests });
}
