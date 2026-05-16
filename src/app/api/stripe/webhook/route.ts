import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, intervalForPriceId } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, UserRole, VerificationStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Roles the webhook is willing to flip a fresh VIEWER into based on
// `selectedRole` metadata from checkout. Mirrors `SelectableRole` in
// /api/stripe/checkout. Recruits live here so a high-school user can pay
// and be seated as VERIFIED_RECRUIT immediately; they later upgrade to
// VERIFIED_ATHLETE on the same account via the verification flow.
const SELECTABLE_ROLES = new Set<UserRole>([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_PARENT,
  UserRole.VERIFIED_RECRUIT,
]);

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
    case "trialing":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.FREE;
  }
}

function readSelectedRole(metadata: Record<string, string> | null | undefined): UserRole | null {
  const v = metadata?.selectedRole as UserRole | undefined;
  return v && SELECTABLE_ROLES.has(v) ? v : null;
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  const status = mapStripeStatus(sub.status);
  const priceId = sub.items.data[0]?.price.id ?? "";
  const interval = intervalForPriceId(priceId);
  const selectedRole = readSelectedRole(sub.metadata as Record<string, string>);
  const becameActive = status === SubscriptionStatus.ACTIVE;

  // Decide the user's new role.
  // - If the user is currently a free VIEWER and we have a selectedRole, promote.
  // - Never demote ATHLETE/STUDENT/PARENT/ADMIN here — billing status changes
  //   should not strip earned roles.
  let role: UserRole = user.role;
  if (becameActive && selectedRole && user.role === UserRole.VIEWER) {
    role = selectedRole;
  }

  // verificationStatus:
  // - On first activation with a fresh role, set PENDING so the user is
  //   nudged into the role-specific verification flow.
  // - Never overwrite an existing VERIFIED status.
  let verificationStatus: VerificationStatus = user.verificationStatus;
  if (
    becameActive &&
    role !== UserRole.VIEWER &&
    role !== UserRole.ADMIN &&
    user.verificationStatus === VerificationStatus.NONE
  ) {
    verificationStatus = VerificationStatus.PENDING;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: status,
      paymentVerified: becameActive,
      stripeSubscriptionId: sub.id,
      role,
      verificationStatus,
    },
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status,
      stripePriceId: priceId,
      interval,
      selectedRole: selectedRole ?? undefined,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    create: {
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      interval,
      selectedRole: selectedRole ?? undefined,
      status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig) {
    // No signature header → not from Stripe. Don't reveal whether secret is set.
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  if (!secret) {
    // Misconfiguration on our side — log loudly but don't echo state to caller.
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
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const subId =
          "subscription" in obj && obj.subscription
            ? (obj.subscription as string)
            : (obj as Stripe.Subscription).id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
