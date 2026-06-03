import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/subscription";
import { AUDIT_ACTIONS, logAdminAction } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig) {
    // No signature header → not from Stripe. Don't reveal whether secret is set.
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  if (!secret) {
    // Misconfiguration on our side — log loudly but don't echo state to caller.
    // eslint-disable-next-line no-console
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    // Signature mismatch / malformed payload — treat as 400 without echoing details.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[stripe webhook] signature verification failed:", err);
    }
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;

        // --- Account-on-Payment materialization ---------------------------
        // If this checkout was opened by /api/auth/start-paid-signup, the
        // session metadata carries a `pendingSignupId`. THIS is the first
        // moment we're allowed to create the real User row — Stripe has
        // confirmed the checkout (trial start counts as confirmation; the
        // card is on file and the customer is bound).
        //
        // Idempotent: webhook re-deliveries are handled in materializeUserFromPendingSignup
        // by looking up the existing PendingSignup (deleted on first success)
        // OR the existing User via stripeCustomerId.
        const pendingId = cs.metadata?.pendingSignupId as string | undefined;
        if (pendingId) {
          await materializeUserFromPendingSignup(pendingId, cs);
        }

        if (cs.subscription) {
          const sub = await stripe.subscriptions.retrieve(cs.subscription as string);
          // Carry checkout metadata onto the subscription if Stripe didn't already.
          if (!sub.metadata?.selectedRole && cs.metadata?.selectedRole) {
            sub.metadata = { ...(sub.metadata ?? {}), ...(cs.metadata as Record<string, string>) };
          }
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_succeeded": {
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const subId =
          "subscription" in obj && obj.subscription
            ? (obj.subscription as string)
            : (obj as Stripe.Subscription).id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);

          // Safety net: if this is the FIRST event we receive for an
          // Account-on-Payment signup (i.e. checkout.session.completed
          // hasn't run yet for whatever reason), the subscription's own
          // metadata also carries pendingSignupId — try to materialize
          // the User now so syncSubscriptionFromStripe below has a
          // user to find.
          const pendingId = sub.metadata?.pendingSignupId as string | undefined;
          if (pendingId) {
            await materializeUserFromPendingSignup(pendingId, null);
          }

          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      case "invoice.payment_failed": {
        // Force-log a payment_failed event regardless of status transition,
        // since Stripe can fire this without the sub's `status` flipping
        // (e.g. first retry attempt still leaves status=active for a beat).
        const inv = event.data.object as Stripe.Invoice;
        const subId = (inv.subscription as string | null) ?? null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscriptionFromStripe(
            sub,
            "stripe_webhook",
            AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_FAILED
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Account-on-Payment materialization helper
// ---------------------------------------------------------------------------
//
// Called from the webhook ONLY for sessions/subscriptions that originated
// in /api/auth/start-paid-signup (identified by the `pendingSignupId`
// metadata key). Atomically:
//   1. Looks up the PendingSignup row by id
//   2. Creates the real User from its fields, linked to the Stripe
//      customer that start-paid-signup already created
//   3. Deletes the PendingSignup row
//
// Idempotent: webhook re-deliveries are safe because:
//   - If PendingSignup is gone, the User must already exist (or the row
//     expired). Either way we no-op.
//   - The transaction touches both rows so a partial state is impossible.
//
// Never throws. Logs to console + skips on missing data so a malformed
// metadata value can't break sync for other events.

async function materializeUserFromPendingSignup(
  pendingSignupId: string,
  // The Checkout Session is optional — when called from
  // customer.subscription.created we don't have it. Only used for
  // the audit-log metadata.
  cs: Stripe.Checkout.Session | null
): Promise<void> {
  let pending;
  try {
    pending = await prisma.pendingSignup.findUnique({
      where: { id: pendingSignupId },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[materializeUser] pendingSignup lookup failed", err);
    return;
  }
  if (!pending) {
    // Already materialized (webhook re-delivery) — no-op.
    return;
  }

  // Race guard: if a User already exists with this email or this stripe
  // customer, skip creation but still clean up the PendingSignup row.
  const dupe = await prisma.user.findFirst({
    where: {
      OR: [
        { email: pending.email },
        { stripeCustomerId: pending.stripeCustomerId },
      ],
    },
    select: { id: true },
  });
  if (dupe) {
    await prisma.pendingSignup
      .delete({ where: { id: pending.id } })
      .catch(() => {
        /* ignore */
      });
    return;
  }

  const acceptedAt = new Date();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: pending.email,
          name: pending.name,
          passwordHash: pending.passwordHash,
          // Stamp the chosen participation role + bind to Stripe customer
          // up front — syncSubscriptionFromStripe (called right after this
          // in the webhook) will then find the user by stripeCustomerId.
          role: pending.selectedRole,
          stripeCustomerId: pending.stripeCustomerId,
          // Verification stays NONE — the user still has to submit proof.
          // (The Phase 1 participation gate keeps them view-only until
          // verification is APPROVED.)
          // Legal acceptance carried from the form submit.
          termsAcceptedAt: acceptedAt,
          termsAcceptedVersion: pending.acceptedTermsVersion,
          privacyAcceptedAt: acceptedAt,
          privacyAcceptedVersion: pending.acceptedPrivacyVersion,
        },
      });
      await tx.pendingSignup.delete({ where: { id: pending.id } });
      return created;
    });

    // Compliance evidence — mirrors what /api/auth/register logs for
    // the FREE-tier signup path.
    await logAdminAction({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.LEGAL_TERMS_ACCEPTED,
      targetType: "User",
      targetId: user.id,
      metadata: {
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: acceptedAt.toISOString(),
        source: "paid_signup_webhook",
        stripeCheckoutSessionId: cs?.id ?? null,
        stripeCustomerId: pending.stripeCustomerId,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[materializeUser] transaction failed", err);
    // Don't rethrow — the webhook handler should still 200 so Stripe
    // doesn't retry; we'll catch the missing User on the next event
    // delivery (subscription.updated etc.) and re-materialize.
  }
}
