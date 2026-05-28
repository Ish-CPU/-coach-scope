import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { intervalForPriceId } from "@/lib/stripe";
import {
  BillingInterval,
  SubscriptionStatus,
  UserRole,
  VerificationStatus,
  type Subscription as PrismaSubscription,
} from "@prisma/client";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit-log";

// SERVER-ONLY module. Imports Prisma + Stripe SDK. Do NOT import from a
// client component — use the pre-computed view object instead.

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------
//
// Single source of truth for the Stripe → our enum translation. Lives here
// (not in the webhook file) so the cancel/reactivate API routes can reuse
// the same logic when they receive Stripe's response.
//
// State machine, in plain English:
//   ACTIVE   : paying, current, NOT scheduled to cancel
//   CANCELED : paying, current, scheduled to cancel at period end
//               → user still has access; UI shows a "Reactivate" affordance
//   EXPIRED  : terminated — access revoked
//   PAST_DUE : payment failed; Stripe is retrying; access revoked
//   FREE     : never paid / cleared out
//
// Why CANCELED is its own state rather than "ACTIVE + flag":
//   The UI cares deeply about the difference, every middleware reading
//   `subscriptionStatus` should make the same decision, and storing it
//   explicitly means a downstream consumer (admin dashboards, exports)
//   doesn't need to know about the cancelAtPeriodEnd field to render
//   the right copy.

export function statusFromStripe(sub: Stripe.Subscription): SubscriptionStatus {
  const cancelScheduled = sub.cancel_at_period_end === true;
  switch (sub.status) {
    case "trialing":
      // In the trial. If they've scheduled a cancel, they still keep
      // trial access until the trial date passes (CANCELED), then Stripe
      // transitions to canceled → EXPIRED. Otherwise it's a live trial.
      return cancelScheduled ? SubscriptionStatus.CANCELED : SubscriptionStatus.TRIALING;
    case "active":
      return cancelScheduled ? SubscriptionStatus.CANCELED : SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.EXPIRED;
    default:
      return SubscriptionStatus.FREE;
  }
}

/**
 * Whether the user is currently entitled to premium actions. CANCELED
 * still counts as access (the user paid for the period and we honor it).
 * Wraps the truthiness check so every gate uses the same definition.
 */
export function statusGrantsAccess(status: SubscriptionStatus): boolean {
  // TRIALING grants full access (the trial is meant to be the real
  // experience). CANCELED still counts (they paid/trialed for the period
  // and we honor it until it ends). EXPIRED / PAST_DUE / FREE do not.
  return (
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.TRIALING ||
    status === SubscriptionStatus.CANCELED
  );
}

// ---------------------------------------------------------------------------
// Display helpers — used by the settings page UI
// ---------------------------------------------------------------------------

export interface SubscriptionView {
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  /** Renewal date if ACTIVE; access-end date if CANCELED; sub-ended date if EXPIRED. */
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** ISO string convenience for serializing to client components. */
  periodEndIso: string | null;
}

export function viewFromSubscription(
  sub: PrismaSubscription | null | undefined
): SubscriptionView {
  if (!sub) {
    return {
      status: SubscriptionStatus.FREE,
      interval: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      periodEndIso: null,
    };
  }
  return {
    status: sub.status,
    interval: sub.interval,
    periodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    periodEndIso: sub.currentPeriodEnd?.toISOString() ?? null,
  };
}

/** Human-readable label for a status — exposed for badges and emails. */
export function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case SubscriptionStatus.TRIALING: return "Free trial";
    case SubscriptionStatus.ACTIVE:   return "Active";
    case SubscriptionStatus.CANCELED: return "Canceled";
    case SubscriptionStatus.EXPIRED:  return "Expired";
    case SubscriptionStatus.PAST_DUE: return "Past due";
    case SubscriptionStatus.FREE:
    default:                          return "No subscription";
  }
}

/** Tailwind classes for a status pill. */
export function statusBadgeClasses(status: SubscriptionStatus): string {
  switch (status) {
    case SubscriptionStatus.TRIALING:
      return "bg-sky-100 text-sky-800 border-sky-200";
    case SubscriptionStatus.ACTIVE:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case SubscriptionStatus.CANCELED:
      return "bg-amber-100 text-amber-800 border-amber-200";
    case SubscriptionStatus.EXPIRED:
      return "bg-slate-100 text-slate-700 border-slate-200";
    case SubscriptionStatus.PAST_DUE:
      return "bg-red-100 text-red-800 border-red-200";
    case SubscriptionStatus.FREE:
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// ---------------------------------------------------------------------------
// Event logger — append-only billing history
// ---------------------------------------------------------------------------

/**
 * Persist a SubscriptionEvent row. Never throws — the underlying business
 * action (cancel button click, webhook handler) must succeed even if the
 * audit row write fails. Errors go to console for dev visibility.
 *
 * `eventType` should be one of AUDIT_ACTIONS.SUBSCRIPTION_* so the same
 * string lands in both AdminActionLog (when invoked from admin paths)
 * and SubscriptionEvent (always), giving us a unified billing timeline.
 */
export async function recordSubscriptionEvent(input: {
  userId: string;
  subscriptionId?: string | null;
  eventType: AuditAction | string;
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean | null;
  periodEnd?: Date | null;
  source: "user" | "stripe_webhook" | "admin";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.subscriptionEvent.create({
      data: {
        userId: input.userId,
        subscriptionId: input.subscriptionId ?? null,
        eventType: input.eventType,
        status: input.status,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? null,
        periodEnd: input.periodEnd ?? null,
        source: input.source,
        metadata: input.metadata ? (input.metadata as any) : undefined,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[subscription event] failed to log", input.eventType, err);
  }
}

/**
 * Decide which canonical event key to log for a given status transition.
 * Returns null if nothing meaningful happened (e.g. status didn't change).
 * Called by the webhook so it doesn't have to repeat the if/else chain.
 */
export function deriveEventType(
  previous: SubscriptionStatus | null | undefined,
  next: SubscriptionStatus,
  previousCancelFlag?: boolean | null,
  nextCancelFlag?: boolean | null
): AuditAction | null {
  // Transition to expired or past-due is always interesting.
  if (next === SubscriptionStatus.EXPIRED && previous !== SubscriptionStatus.EXPIRED) {
    return AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED;
  }
  if (next === SubscriptionStatus.PAST_DUE && previous !== SubscriptionStatus.PAST_DUE) {
    return AUDIT_ACTIONS.SUBSCRIPTION_PAST_DUE;
  }
  // First time we see this subscription become accessible — includes a
  // trial start (FREE → TRIALING).
  if (
    (next === SubscriptionStatus.ACTIVE ||
      next === SubscriptionStatus.TRIALING ||
      next === SubscriptionStatus.CANCELED) &&
    (previous === SubscriptionStatus.FREE ||
      previous === SubscriptionStatus.EXPIRED ||
      previous == null)
  ) {
    return AUDIT_ACTIONS.SUBSCRIPTION_CREATED;
  }
  // Toggling the cancel-at-period-end flag while staying accessible.
  if (
    previous === SubscriptionStatus.ACTIVE &&
    next === SubscriptionStatus.CANCELED &&
    nextCancelFlag === true
  ) {
    return AUDIT_ACTIONS.SUBSCRIPTION_CANCELED;
  }
  if (
    previous === SubscriptionStatus.CANCELED &&
    next === SubscriptionStatus.ACTIVE &&
    !nextCancelFlag
  ) {
    return AUDIT_ACTIONS.SUBSCRIPTION_REACTIVATED;
  }
  // Returning to ACTIVE from PAST_DUE = successful retry.
  if (
    previous === SubscriptionStatus.PAST_DUE &&
    (next === SubscriptionStatus.ACTIVE || next === SubscriptionStatus.CANCELED)
  ) {
    return AUDIT_ACTIONS.SUBSCRIPTION_RENEWED;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sync orchestration — apply a Stripe Subscription payload to our DB
// ---------------------------------------------------------------------------
//
// Shared between:
//   - the Stripe webhook (event-driven, the normal path)
//   - the /api/stripe/cancel and /api/stripe/reactivate endpoints, which
//     mutate the subscription via Stripe's API and then re-run this sync
//     directly so the UI has the new state on the very next render
//     without waiting for the webhook round-trip.
//
// Idempotent: a re-delivered webhook event yields no new SubscriptionEvent
// row because deriveEventType() returns null when status hasn't changed.

// Roles the system is willing to flip a fresh VIEWER into on first
// activation. Mirrors `SelectableRole` in /api/stripe/checkout.
const SELECTABLE_ROLES = new Set<UserRole>([
  UserRole.VERIFIED_ATHLETE,
  UserRole.VERIFIED_STUDENT,
  UserRole.VERIFIED_PARENT,
  UserRole.VERIFIED_RECRUIT,
]);

function readSelectedRole(
  metadata: Record<string, string> | null | undefined
): UserRole | null {
  const v = metadata?.selectedRole as UserRole | undefined;
  return v && SELECTABLE_ROLES.has(v) ? v : null;
}

export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
  source: "stripe_webhook" | "user" | "admin" = "stripe_webhook",
  eventTypeOverride?: string
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;

  // Diff against the previous row so we can emit the right event.
  const previous = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });
  const previousStatus = previous?.status ?? user.subscriptionStatus ?? null;
  const previousCancelFlag = previous?.cancelAtPeriodEnd ?? null;

  const status = statusFromStripe(sub);
  const priceId = sub.items.data[0]?.price.id ?? "";
  const interval = intervalForPriceId(priceId);
  const selectedRole = readSelectedRole(sub.metadata as Record<string, string>);
  const grantsAccess = statusGrantsAccess(status);
  // Only run the "first time becoming accessible" role/verification flip
  // on the FIRST transition into ACTIVE/CANCELED. A later
  // CANCELED→ACTIVE reactivation shouldn't try to re-promote VIEWER → role
  // (the user already has their real role from the first activation).
  const becameAccessible =
    grantsAccess && (previousStatus == null || !statusGrantsAccess(previousStatus));

  let role: UserRole = user.role;
  if (becameAccessible && selectedRole && user.role === UserRole.VIEWER) {
    role = selectedRole;
  }

  let verificationStatus: VerificationStatus = user.verificationStatus;
  if (
    becameAccessible &&
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
      paymentVerified: grantsAccess,
      stripeSubscriptionId: sub.id,
      role,
      verificationStatus,
    },
  });

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;

  const upserted = await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status,
      stripePriceId: priceId,
      interval,
      selectedRole: selectedRole ?? undefined,
      currentPeriodEnd: periodEnd ?? undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
    create: {
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      interval,
      selectedRole: selectedRole ?? undefined,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    },
  });

  const eventType =
    eventTypeOverride ??
    deriveEventType(previousStatus, status, previousCancelFlag, sub.cancel_at_period_end);
  if (eventType) {
    await recordSubscriptionEvent({
      userId: user.id,
      subscriptionId: upserted.id,
      eventType,
      status,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? null,
      periodEnd,
      source,
      metadata: {
        previousStatus,
        previousCancelFlag,
        stripeStatus: sub.status,
        stripePriceId: priceId,
      },
    });
  }
}
