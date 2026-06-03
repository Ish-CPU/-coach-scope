/**
 * POST /api/auth/start-paid-signup
 *
 * Server-side entry point for the "Account-on-Payment" flow.
 * Replaces the old `register-then-pay` order for PAID tiers — closes the
 * loophole where a user filled out the form, hit Stripe, abandoned, and
 * left an orphaned unpaid account behind. Free OTHER signups continue
 * through /api/auth/register because there's no payment to wait for.
 *
 * RESPONSIBILITIES
 *   1. Validate the signup form (same shape as /api/auth/register, plus
 *      `selectedRole` + `interval`).
 *   2. Reject if email is already a real User (avoid hijacking an existing
 *      account by paying for it).
 *   3. Clear any prior PendingSignup for this email (a retry on the same
 *      email is allowed — they abandoned an earlier attempt).
 *   4. bcrypt-hash the password and persist it in PendingSignup. The hash
 *      is the same shape as User.passwordHash, so on confirmation we
 *      copy it directly.
 *   5. Create the Stripe Customer up front so the Checkout Session has
 *      something to bind to. Customer is stored on PendingSignup so the
 *      webhook can carry it onto the eventual User row.
 *   6. Open a Stripe Checkout Session with `subscription_data` (including
 *      the 4-day trial from Phase 1) and metadata containing
 *      `pendingSignupId`. The webhook reads that to materialize the User.
 *
 * IMPORTANT
 *   - We DO NOT issue a session cookie here. The user lands on /welcome
 *     after Stripe confirms; signs in there with the credentials they
 *     just chose. This guarantees no "logged in but unpaid" state.
 *   - Plaintext password never leaves this handler — only the bcrypt
 *     hash hits the DB; Stripe receives neither.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { stripe, priceForInterval } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl, requireEnv } from "@/lib/env";
import { PASSWORD_BCRYPT_ROUNDS } from "@/lib/security";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-versions";
import { BillingInterval, UserRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PendingSignup is only ever opened for the four paid participation roles.
// VIEWER doesn't pay and goes through /api/auth/register. Admin roles
// are server-side only.
const PAID_ROLES = new Set<UserRole>([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_PARENT,
  UserRole.VERIFIED_RECRUIT,
]);

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  // Whitelisted server-side so a tampered client can't smuggle ADMIN /
  // MASTER_ADMIN into selectedRole. Defense-in-depth — the PAID_ROLES set
  // below is the gate.
  selectedRole: z.nativeEnum(UserRole),
  interval: z.nativeEnum(BillingInterval),
  acceptedTermsVersion: z.string().min(1).max(40),
  acceptedPrivacyVersion: z.string().min(1).max(40),
});

export async function POST(req: Request) {
  // Same per-IP cap as /api/auth/register — both endpoints together share
  // the practical "max new accounts per IP" budget.
  const limited = await rateLimit(req, "auth:start-paid-signup", {
    max: 5,
    windowMs: 5 * 60_000,
  });
  if (limited) return limited;

  try {
    requireEnv("STRIPE_SECRET_KEY");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe not configured" },
      { status: 500 }
    );
  }

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
  const {
    name,
    email,
    password,
    selectedRole,
    interval,
    acceptedTermsVersion,
    acceptedPrivacyVersion,
  } = parsed.data;

  if (!PAID_ROLES.has(selectedRole)) {
    return NextResponse.json(
      { error: "Selected role is not eligible for paid signup." },
      { status: 400 }
    );
  }

  // Reject stale clients — the legal-version constants change when the
  // policy text changes; the webhook stamps these onto the new User row
  // for compliance evidence.
  if (
    acceptedTermsVersion !== CURRENT_TERMS_VERSION ||
    acceptedPrivacyVersion !== CURRENT_PRIVACY_VERSION
  ) {
    return NextResponse.json(
      {
        error:
          "Our Terms of Service or Privacy Policy were updated. Please reload the page and try again.",
      },
      { status: 409 }
    );
  }

  const normalizedEmail = email.toLowerCase();

  // Don't let a paid signup hijack an existing real account.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "An account already exists for that email. Sign in instead, then start your subscription from the pricing page.",
      },
      { status: 409 }
    );
  }

  const priceId = priceForInterval(interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${interval}.` },
      { status: 500 }
    );
  }

  // Clear any abandoned earlier attempt for this email — the user is
  // retrying, let them. The unique constraint on email would otherwise
  // reject the create() below.
  await prisma.pendingSignup.deleteMany({ where: { email: normalizedEmail } });

  const passwordHash = await bcrypt.hash(password, PASSWORD_BCRYPT_ROUNDS);

  // Create the Stripe customer FIRST so the Checkout Session has a
  // customer to bind to. If we created PendingSignup first, a Stripe
  // failure would leave an orphan row; this order means a Stripe failure
  // simply aborts before we touch our DB at all.
  let customer;
  try {
    customer = await stripe.customers.create({
      email: normalizedEmail,
      name,
      metadata: {
        // Reverse-link for support / debugging. The actual app-side ID
        // (PendingSignup id) gets stamped after we persist below.
        source: "start-paid-signup",
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[start-paid-signup] stripe.customers.create failed", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }

  // 24-hour TTL — matches the natural "user comes back later to finish"
  // window. A cron job (future) can sweep expired rows; in the
  // meantime they're harmless (unique email + customer ID).
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);

  let pending;
  try {
    pending = await prisma.pendingSignup.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash,
        selectedRole,
        interval,
        stripeCustomerId: customer.id,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        expiresAt,
      },
    });
  } catch (err) {
    // Roll back the Stripe customer we just created so we don't leak
    // dangling customers on retry. Best-effort — if Stripe is also down
    // we already returned an error to the user.
    try {
      await stripe.customers.del(customer.id);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line no-console
    console.error("[start-paid-signup] PendingSignup.create failed", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }

  const base = appUrl();

  let checkout;
  try {
    checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      // After Stripe confirms, land on /welcome with the session ID so
      // the page can poll for the webhook-created User and prompt
      // sign-in with the email they just registered.
      success_url: `${base}/welcome?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout=canceled`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      billing_address_collection: "auto",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      subscription_data: {
        trial_period_days: 4,
        metadata: {
          // The webhook reads `pendingSignupId` from BOTH metadata
          // locations (checkout session + subscription) so whichever
          // event fires first can materialize the User.
          pendingSignupId: pending.id,
          selectedRole,
          interval,
        },
      },
      metadata: {
        pendingSignupId: pending.id,
        selectedRole,
        interval,
      },
    });
  } catch (err) {
    // Roll back our DB writes + the Stripe customer.
    try {
      await prisma.pendingSignup.delete({ where: { id: pending.id } });
    } catch {
      /* ignore */
    }
    try {
      await stripe.customers.del(customer.id);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line no-console
    console.error("[start-paid-signup] checkout session create failed", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }

  // Stamp the checkout session ID for later diagnostic / cleanup.
  await prisma.pendingSignup
    .update({
      where: { id: pending.id },
      data: { stripeCheckoutSessionId: checkout.id },
    })
    .catch(() => {
      // Non-fatal — Stripe holds the canonical link via metadata.
    });

  return NextResponse.json(
    { url: checkout.url, pendingSignupId: pending.id },
    { status: 201 }
  );
}
