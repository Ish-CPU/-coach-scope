import Stripe from "stripe";
import { BillingInterval } from "@prisma/client";

if (!process.env.STRIPE_SECRET_KEY) {
  // Allow imports during build without throwing; runtime callers should check.
  // eslint-disable-next-line no-console
  console.warn("[stripe] STRIPE_SECRET_KEY missing — Stripe routes will fail until set.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion:  "2025-02-24.acacia",
  typescript: true,
});

// Two recurring prices: $5.99/mo and $69.99/yr
// `STRIPE_PRICE_ID` is kept as a fallback for the monthly plan to remain
// backward-compatible with older deployments.
export const PRICE_MONTHLY =
  process.env.STRIPE_PRICE_MONTHLY_ID ?? process.env.STRIPE_PRICE_ID ?? "";
export const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY_ID ?? "";

export function priceForInterval(interval: BillingInterval): string {
  return interval === BillingInterval.YEARLY ? PRICE_YEARLY : PRICE_MONTHLY;
}

export function intervalForPriceId(priceId: string | null | undefined): BillingInterval {
  if (priceId && PRICE_YEARLY && priceId === PRICE_YEARLY) return BillingInterval.YEARLY;
  return BillingInterval.MONTHLY;
}

/** Stripe display strings — single source of truth for pricing copy. */
export const PLAN_DISPLAY = {
  MONTHLY: {
    label: "Monthly",
    price: "$5.99",
    cadence: "/month",
    note: "Billed every 30 days starting from your signup date.",
  },
  YEARLY: {
    label: "Yearly",
    price: "$69.99",
    cadence: "/year",
    note: "Save compared to monthly billing.",
  },
} as const;
