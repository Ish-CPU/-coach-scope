import { NextResponse } from "next/server";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { requireEnv } from "@/lib/env";
import { syncSubscriptionFromStripe } from "@/lib/subscription";
import { AUDIT_ACTIONS } from "@/lib/audit-log";
import { SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User-initiated cancellation. We schedule the cancel at period end so the
 * user keeps the access they already paid for — Stripe will then transition
 * the subscription to `canceled` automatically when the period ends, which
 * the webhook picks up and turns into our EXPIRED state.
 *
 * Why not pass-through to the Stripe billing portal? The portal works
 * but pops the user out to a Stripe-hosted page. The product brief wants
 * an in-app confirmation flow with a custom modal, so we own the cancel
 * call here and then immediately re-sync our DB from the Stripe response
 * (instead of waiting for the customer.subscription.updated webhook to
 * round-trip back).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Tight per-user limit. Even a determined user shouldn't be calling
  // cancel/reactivate more than a handful of times an hour.
  const limited = rateLimit(req, "stripe:cancel", {
    max: 10,
    windowMs: 60 * 60_000,
    identifier: session.user.id,
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

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  // No live Stripe subscription on the account — nothing to cancel.
  // We return 400 (not 404) because from the caller's perspective they
  // posted a request that doesn't apply to their current state.
  if (!user.stripeSubscriptionId || !user.subscription) {
    return NextResponse.json(
      { error: "No active subscription on file." },
      { status: 400 }
    );
  }

  // If already scheduled to cancel, or already expired/free, no-op cleanly.
  // We still return 200 so the client UI converges on the same final state
  // regardless of how many duplicate clicks the user fires.
  if (
    user.subscription.status === SubscriptionStatus.CANCELED ||
    user.subscription.status === SubscriptionStatus.EXPIRED ||
    user.subscription.status === SubscriptionStatus.FREE
  ) {
    return NextResponse.json({
      ok: true,
      alreadyScheduled: true,
      status: user.subscription.status,
      periodEnd: user.subscription.currentPeriodEnd?.toISOString() ?? null,
    });
  }

  let updated;
  try {
    updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
      metadata: {
        // Preserve any prior metadata (selectedRole, interval) by merging.
        ...((user.subscription.selectedRole && {
          selectedRole: user.subscription.selectedRole,
        }) ||
          {}),
        canceledBy: "user",
        canceledAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe cancel]", err);
    return NextResponse.json(
      { error: "Stripe rejected the cancellation. Please try again." },
      { status: 502 }
    );
  }

  // Re-sync our DB from the Stripe response immediately so the next page
  // render shows CANCELED + a Reactivate button (instead of stale ACTIVE
  // until the webhook arrives a second or two later).
  // Pass an explicit event type so the audit row reads "user.canceled"
  // even if deriveEventType would have inferred the same.
  await syncSubscriptionFromStripe(updated, "user", AUDIT_ACTIONS.SUBSCRIPTION_CANCELED);

  return NextResponse.json({
    ok: true,
    status: SubscriptionStatus.CANCELED,
    periodEnd: updated.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : null,
  });
}
