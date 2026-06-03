/**
 * GET /api/auth/post-checkout-status?cs=<checkout_session_id>
 *
 * Polled by /welcome (WelcomeSignInClient) to find out when the Stripe
 * webhook has materialized the real User from the PendingSignup. Returns
 * `{ ready: true }` once the User exists, `{ ready: false }` otherwise.
 *
 * Look-up strategy:
 *   1. Pull the Checkout Session from Stripe to find the customer ID
 *   2. Check if a User exists with that stripeCustomerId
 *
 * Why not expose User ID or email here: this endpoint is unauthenticated
 * (it has to be — the user can't sign in until the User exists). We
 * deliberately return only a boolean so a poller can't enumerate
 * Stripe-customer ↔ user mappings.
 */
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // High cap because the /welcome client polls every 1.5s for up to 25s
  // = ~17 requests per signup. Below 60/min keeps it ample for a fast
  // re-sign-in.
  const limited = await rateLimit(req, "auth:post-checkout-status", {
    max: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const cs = url.searchParams.get("cs");
  if (!cs) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }

  let customerId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(cs);
    customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? null;
  } catch {
    // Invalid session id → just say not ready, don't 500.
    return NextResponse.json({ ready: false }, { status: 200 });
  }

  if (!customerId) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  return NextResponse.json({ ready: Boolean(user) }, { status: 200 });
}
