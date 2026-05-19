import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { syncSubscriptionFromStripe } from "@/lib/subscription";
import { AUDIT_ACTIONS } from "@/lib/audit-log";

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
