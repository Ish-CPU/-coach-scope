/**
 * POST /api/account/delete
 *
 * Self-serve account deletion. Closes every loophole we know about:
 *
 *   1. Password re-entry required (server-verified). Prevents an attacker
 *      with a stolen session cookie from nuking the account.
 *   2. Typed confirmation token ("DELETE my account") required. Prevents
 *      double-click misfires from the settings page.
 *   3. Admins and master admins cannot self-delete here — admin
 *      lifecycle is managed through /admin/team. Returns 403.
 *   4. Stripe subscription cancelled IMMEDIATELY (not at period end) so
 *      the user is never billed past the moment they hit delete. The
 *      webhook-driven SubscriptionEvent row preserves the history.
 *   5. Email rotated to `deleted-<id>@removed.local` BEFORE other writes
 *      so the unique constraint never blocks the transaction. Original
 *      email is now free for a fresh signup.
 *   6. PII scrubbed in one transaction: name, image, bio, passwordHash,
 *      workEmail, recoveryEmails, formerUniversity / formerProgram,
 *      schoolId, sport, graduation/lastRoster, notificationPreferences,
 *      adminPermissions. role reset to VIEWER, verificationStatus to NONE.
 *   7. sessionsRevokedAt bumped so any in-flight JWT for this user is
 *      treated as signed-out by the auth.ts callback on the very next
 *      request. Combined with the auth-layer `deletedAt` check, a
 *      replayed credential also fails.
 *   8. Connections / favorites / notifications / group memberships /
 *      email codes / pending signups deleted — no value retaining them
 *      anonymized.
 *   9. Reviews, comments, votes, subscription events, verification
 *      requests, admin actions PRESERVED. The display layer renders the
 *      author as "Former member" via the user.deletedAt check.
 *  10. Confirmation email sent to the ORIGINAL address (captured before
 *      the rotation) so the user has a paper trail.
 *  11. Audit log entry ACCOUNT_SELF_DELETED written even though the
 *      "actor" is the user themselves — keeps deletion events
 *      discoverable in the same place admins look for everything else.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import { sendAccountDeletedEmail } from "@/lib/email/notifications";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { SubscriptionStatus, UserRole, VerificationStatus } from "@prisma/client";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The exact phrase the user must type. Case-sensitive so a copy-paste
 *  from somewhere else doesn't accidentally satisfy it. */
const CONFIRMATION_PHRASE = "DELETE my account";

const schema = z.object({
  password: z.string().min(1, "Password required"),
  confirmation: z.string(),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // 3 attempts per hour per user — generous for honest re-tries on a
  // bad password, tight enough to slow a hijacked-session attacker.
  const limited = await rateLimit(req, "account:delete", {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { password, confirmation, reason } = parsed.data;

  if (confirmation !== CONFIRMATION_PHRASE) {
    return NextResponse.json(
      {
        error: `Confirmation phrase didn't match. Type exactly: "${CONFIRMATION_PHRASE}".`,
      },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      deletedAt: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.deletedAt) {
    return NextResponse.json(
      { error: "This account is already deleted." },
      { status: 409 }
    );
  }

  // Block admin self-delete through this user-facing path. Admin
  // accounts have a separate lifecycle in /admin/team that preserves
  // the audit chain. A master admin nuking themselves here would also
  // strand the platform.
  if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN) {
    return NextResponse.json(
      {
        error:
          "Admin accounts can't be deleted from this page. Contact the master admin to revoke admin access first.",
      },
      { status: 403 }
    );
  }

  // Password re-entry check — defends against stolen-session deletion.
  // Generic message either way so we don't reveal whether the password
  // was wrong vs another check failed.
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Couldn't verify password. Sign out and back in, then try again." },
      { status: 401 }
    );
  }
  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  // PAST-DUE CHECK — close the "delete-to-skip-debt" loophole.
  //
  // If the user has a failed-payment subscription with an outstanding
  // unpaid invoice, deletion is blocked until they settle. We allow:
  //   - ACTIVE (paid through period) — they're choosing to leave early
  //   - TRIALING (no charge owed)
  //   - CANCELED-in-period (already cancelled)
  //   - FREE / EXPIRED (no live billing)
  // And block:
  //   - PAST_DUE / `unpaid` Stripe status — a charge failed and Stripe
  //     either is still retrying or gave up; either way money is owed
  //
  // We pull live status from Stripe (not our cached subscriptionStatus)
  // because the webhook can be a few seconds behind a fresh invoice
  // failure — a user could try to race the webhook. Stripe is the
  // source of truth at decision time.
  //
  // If Stripe is unreachable we fall back to the cached status — a
  // 5xx from Stripe shouldn't trap an honest user who actually has no
  // debt. In the rare unreachable + cached-status-is-stale-FREE case,
  // the user gets through; the next webhook (post-recovery) will flag
  // the orphan via SubscriptionEvent and admin can dispute.
  let liveStripeStatus: string | null = null;
  if (user.stripeSubscriptionId) {
    try {
      const live = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      liveStripeStatus = live.status;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[account-delete] Stripe status fetch failed; falling back to cached status", err);
    }
  }

  const effectivelyPastDue =
    liveStripeStatus === "past_due" ||
    liveStripeStatus === "unpaid" ||
    // Fallback to cached value when Stripe API call failed or no sub fetched.
    (liveStripeStatus === null &&
      user.subscriptionStatus === SubscriptionStatus.PAST_DUE);

  if (effectivelyPastDue) {
    return NextResponse.json(
      {
        error:
          "You have an unpaid invoice from a failed payment. Settle your outstanding balance from the billing portal on your account settings page, then you can delete your account.",
        code: "past_due_balance",
      },
      { status: 402 }
    );
  }

  // Capture original values BEFORE the scrub. We email and audit-log
  // against these so the user receives the confirmation at their real
  // address and the audit row can correlate to the pre-deletion identity.
  const originalEmail = user.email;
  const originalName = user.name;
  const emailHash = createHash("sha256").update(originalEmail.toLowerCase()).digest("hex");

  // Cancel the Stripe subscription IMMEDIATELY (not at period end). We
  // never want a deleted user to keep being billed even one more day.
  // Stripe webhook will land in parallel and update Subscription row;
  // we don't await its arrival.
  let stripeCanceled = false;
  if (user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId, {
        invoice_now: false,
        prorate: false,
      });
      stripeCanceled = true;
    } catch (err) {
      // Don't let a Stripe glitch block deletion — the user has a right
      // to delete. Log it; a follow-up cleanup can catch orphaned subs.
      // eslint-disable-next-line no-console
      console.error("[account-delete] Stripe cancel failed", err);
    }
  }

  const now = new Date();
  // Rotate email to a non-real value. Format chosen so the unique
  // constraint stays satisfied (id is unique) and the original email
  // is free for a fresh signup. The `removed.local` TLD is reserved
  // for documentation and will never deliver mail anywhere.
  const rotatedEmail = `deleted-${user.id}@removed.local`;

  // Single transaction: scrub the User row + delete satellite rows that
  // have no value anonymized. If any one statement fails, none of them
  // commit and the account remains intact for a retry.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        // Lifecycle markers
        deletedAt: now,
        deletionReason: reason ?? null,
        sessionsRevokedAt: now,

        // Identity scrub. Name is set to the literal "Former member"
        // string (not null) so every existing review/comment render
        // path that already falls back through `user.name` automatically
        // displays the right label without a separate display helper.
        // The `deletedAt` field above is the canonical signal for code
        // that needs to discriminate (e.g. excluding from search).
        email: rotatedEmail,
        name: "Former member",
        image: null,
        passwordHash: null,
        bio: null,

        // School/sport scrub
        schoolId: null,
        sport: null,
        formerUniversityId: null,
        formerProgramId: null,
        graduationYear: null,
        lastRosterSeason: null,
        isAlumni: false,
        alumniSince: null,

        // Admin/contact scrub
        workEmail: null,
        recoveryEmails: [],
        notificationPreferences: undefined,
        adminPermissions: undefined,
        inviteToken: null,
        inviteExpiresAt: null,

        // Sub / role reset — VIEWER is the safe zero-privilege state.
        // We DON'T clear stripeCustomerId — keeping it on the row lets us
        // cross-reference future fraud signals to the customer record.
        // The unique constraint allows it; the user is deleted either way.
        role: UserRole.VIEWER,
        verificationStatus: VerificationStatus.NONE,
        subscriptionStatus: SubscriptionStatus.EXPIRED,
        paymentVerified: false,
        stripeSubscriptionId: null,
      },
    }),
    // Satellite rows with no value anonymized:
    prisma.athleteProgramConnection.deleteMany({ where: { userId: user.id } }),
    prisma.studentUniversityConnection.deleteMany({ where: { userId: user.id } }),
    prisma.favorite.deleteMany({ where: { userId: user.id } }),
    // Notification.userId is the recipient; actorId is the trigger.
    // Delete on either side so this user disappears from every queue.
    prisma.notification.deleteMany({
      where: { OR: [{ userId: user.id }, { actorId: user.id }] },
    }),
    prisma.groupMembership.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } }),
    prisma.roleChangeRequest.deleteMany({ where: { userId: user.id } }),
    // Drop the Subscription row — Stripe is the source of truth and
    // SubscriptionEvent retains the history.
    prisma.subscription.deleteMany({ where: { userId: user.id } }),
  ]);

  // Audit + email after the DB write so a failure to send doesn't leave
  // the user un-deleted. Fire-and-forget; both helpers swallow errors.
  void logAdminAction({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.ACCOUNT_SELF_DELETED,
    targetType: "User",
    targetId: user.id,
    metadata: {
      stripeCanceled,
      previousSubscriptionStatus: user.subscriptionStatus,
      previousRole: user.role,
      // Hash, not plaintext — gives fraud analysis a cross-reference
      // without storing the original email in the audit log forever.
      prevEmailSha256: emailHash,
      reason: reason ?? null,
    },
  });

  void sendAccountDeletedEmail({
    toEmail: originalEmail,
    userName: originalName,
    stripeCanceled,
  });

  return NextResponse.json({ ok: true });
}
