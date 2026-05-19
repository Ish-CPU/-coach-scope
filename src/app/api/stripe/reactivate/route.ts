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
 * Reverse a pending cancellation, IF the subscription is still in its paid
 * period. After the period has elapsed Stripe has already fully terminated
 * the sub (status=canceled, our EXPIRED) and there is nothing to reactivate
 * — the user has to go through /pricing and check out fresh.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const limited = rateLimit(req, "stripe:reactivate", {
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

  if (!user.stripeSubscriptionId || !user.subscription) {
    return NextResponse.json(
      { error: "No subscription on file. Visit /pricing to subscribe." },
      { status: 400 }
    );
  }

  // The only state from which "reactivate" makes sense is CANCELED
  // (scheduled to cancel, period still active). Anything else is either
  // already active or fully expired — both require a different code path.
  if (user.subscription.status !== SubscriptionStatus.CANCELED) {
    if (user.subscription.status === SubscriptionStatus.EXPIRED) {
      return NextResponse.json(
        {
          error:
            "Your subscription already ended. Start a new subscription from /pricing.",
        },
        { status: 400 }
      );
    }
    if (user.subscription.status === SubscriptionStatus.ACTIVE) {
      // No-op idempotency for double clicks.
      return NextResponse.json({
        ok: true,
        alreadyActive: true,
        status: SubscriptionStatus.ACTIVE,
      });
    }
    return NextResponse.json(
      { error: `Cannot reactivate from status ${user.subscription.status}.` },
      { status: 400 }
    );
  }

  let updated;
  try {
    updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
      metadata: {
        ...((user.subscription.selectedRole && {
          selectedRole: user.subscription.selectedRole,
        }) ||
          {}),
        reactivatedBy: "user",
        reactivatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe reactivate]", err);
    return NextResponse.json(
      { error: "Stripe rejected the reactivation. Please try again." },
      { status: 502 }
    );
  }

  // Immediate DB sync — same rationale as the cancel route.
  await syncSubscriptionFromStripe(
    updated,
    "user",
    AUDIT_ACTIONS.SUBSCRIPTION_REACTIVATED
  );

  return NextResponse.json({
    ok: true,
    status: SubscriptionStatus.ACTIVE,
    periodEnd: updated.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : null,
  });
}
