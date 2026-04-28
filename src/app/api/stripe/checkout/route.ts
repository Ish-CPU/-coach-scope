import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { stripe, priceForInterval } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl, requireEnv } from "@/lib/env";
import { BillingInterval, UserRole } from "@prisma/client";

// Roles a user can pick at checkout — admin/viewer not selectable here.
const SelectableRole = z.enum([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_PARENT,
]);

const schema = z.object({
  interval: z.nativeEnum(BillingInterval).default(BillingInterval.MONTHLY),
  selectedRole: SelectableRole,
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Cap rapid-fire checkout attempts per user.
  const limited = rateLimit(req, "stripe:checkout", {
    max: 10,
    windowMs: 60 * 60_000,
    identifier: session.user.id,
  });
  if (limited) return limited;

  // Fail loudly if the live secret isn't configured (instead of silently
  // posting to Stripe with a placeholder).
  try {
    requireEnv("STRIPE_SECRET_KEY");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe not configured" },
      { status: 500 }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a role (Athlete, Student, or Parent) before checkout." },
      { status: 400 }
    );
  }
  const { interval, selectedRole } = parsed.data;

  const priceId = priceForInterval(interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${interval}. Set STRIPE_PRICE_${interval}_ID.` },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const base = appUrl();

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/verification?checkout=success`,
    cancel_url: `${base}/pricing?checkout=canceled`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id, interval, selectedRole },
    },
    metadata: { userId: user.id, interval, selectedRole },
  });

  return NextResponse.json({ url: checkout.url });
}
