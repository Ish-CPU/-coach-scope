import Link from "next/link";
import { SubscriptionStatus, BillingInterval } from "@prisma/client";
import {
  type SubscriptionView,
  statusLabel,
  statusBadgeClasses,
} from "@/lib/subscription";
import { PLAN_DISPLAY } from "@/lib/stripe";
import { SubscriptionActions } from "./SubscriptionActions";

// Helpers — kept here (not in lib) because they're pure display
// formatting with no business logic.
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function intervalLabel(interval: BillingInterval | null): string {
  if (interval === BillingInterval.YEARLY) return PLAN_DISPLAY.YEARLY.label;
  if (interval === BillingInterval.MONTHLY) return PLAN_DISPLAY.MONTHLY.label;
  return "—";
}

function intervalPrice(interval: BillingInterval | null): string | null {
  if (interval === BillingInterval.YEARLY)
    return `${PLAN_DISPLAY.YEARLY.price}${PLAN_DISPLAY.YEARLY.cadence}`;
  if (interval === BillingInterval.MONTHLY)
    return `${PLAN_DISPLAY.MONTHLY.price}${PLAN_DISPLAY.MONTHLY.cadence}`;
  return null;
}

interface HistoryRow {
  id: string;
  eventType: string;
  status: SubscriptionStatus;
  createdAtIso: string;
}

interface Props {
  view: SubscriptionView;
  hasStripeCustomer: boolean;
  history: HistoryRow[];
}

/**
 * Server component — all interactivity is delegated to <SubscriptionActions>.
 * Keeps the data flow simple: page reads DB, this renders, the client widget
 * handles button clicks + confirmation modal.
 */
export function ManageSubscription({ view, hasStripeCustomer, history }: Props) {
  const { status, interval, periodEndIso, cancelAtPeriodEnd } = view;
  const isCanceled = status === SubscriptionStatus.CANCELED;
  const isExpired = status === SubscriptionStatus.EXPIRED;
  const isPastDue = status === SubscriptionStatus.PAST_DUE;
  const isFree = status === SubscriptionStatus.FREE;
  const hasLiveSub = status === SubscriptionStatus.ACTIVE || isCanceled;
  // The date label changes meaning based on status. Calling it out in the
  // copy avoids ambiguity ("is this when I get charged or when I lose access?").
  const dateLabel =
    status === SubscriptionStatus.ACTIVE
      ? "Renews on"
      : isCanceled
        ? "Access ends on"
        : isExpired
          ? "Ended on"
          : isPastDue
            ? "Last attempted renewal"
            : "—";

  return (
    <section
      aria-labelledby="manage-subscription-heading"
      className="card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="manage-subscription-heading"
            className="text-lg font-semibold"
          >
            Manage subscription
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Your current plan and billing controls.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadgeClasses(status)}`}
          aria-label={`Status: ${statusLabel(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Plan
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {intervalLabel(interval)}
            {intervalPrice(interval) && (
              <span className="ml-2 text-slate-500">
                ({intervalPrice(interval)})
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {dateLabel}
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {formatDate(periodEndIso)}
          </dd>
        </div>
      </dl>

      {/* Contextual messaging — tells the user what the *current* state
          actually means for them. The copy is intentionally explicit
          ("you will continue to have access until X") so cancel-button
          regret doesn't turn into a support ticket. */}
      <div
        className={`mt-6 rounded-lg border p-4 text-sm ${
          isCanceled
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : isExpired
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : isPastDue
                ? "border-red-200 bg-red-50 text-red-900"
                : isFree
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}
      >
        {isCanceled && (
          <>
            <strong>Cancellation scheduled.</strong> Your subscription will
            end on {formatDate(periodEndIso)}. You'll keep full access to all
            premium features until then. Your account, reviews, and history
            stay intact. Change your mind? Reactivate any time before the end
            date.
          </>
        )}
        {isExpired && (
          <>
            <strong>Subscription ended.</strong> Premium posting and review
            features are turned off. Your account and history are preserved.
            <Link
              href="/pricing"
              className="ml-1 font-semibold underline underline-offset-2"
            >
              Subscribe again
            </Link>{" "}
            to restore access.
          </>
        )}
        {isPastDue && (
          <>
            <strong>Payment failed.</strong> Stripe couldn't charge your card
            on the last billing attempt. Update your payment method to keep
            your access — premium features are paused until the renewal goes
            through.
          </>
        )}
        {isFree && (
          <>
            <strong>No active subscription.</strong> Premium posting and
            review features require a paid plan.{" "}
            <Link
              href="/pricing"
              className="font-semibold underline underline-offset-2"
            >
              View plans
            </Link>
            .
          </>
        )}
        {status === SubscriptionStatus.ACTIVE && (
          <>
            <strong>Subscription active.</strong> Your card will be charged on{" "}
            {formatDate(periodEndIso)}. Cancel any time — you'll keep access
            for the rest of the billing period.
          </>
        )}
      </div>

      {/* All interactivity lives in the client component. */}
      <div className="mt-6">
        <SubscriptionActions
          status={status}
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          periodEndIso={periodEndIso}
          hasStripeCustomer={hasStripeCustomer}
        />
      </div>

      {/* Billing history — minimal feed. Hidden if the user has no events
          yet (e.g. brand new account on a free tier). */}
      {history.length > 0 && (
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">
            Billing history ({history.length})
          </summary>
          <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 py-2 text-xs text-slate-600"
              >
                <span className="font-mono">{row.eventType}</span>
                <span>{statusLabel(row.status)}</span>
                <time className="tabular-nums">{formatDate(row.createdAtIso)}</time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
