"use client";

import Link from "next/link";

/**
 * Generic "you need to do something to participate" prompt.
 *
 * MVP wording: the platform is gated by role-verification, not by payment.
 * (Stripe isn't wired yet — the original copy referenced subscriptions.)
 * Re-add subscription messaging once /pricing is live.
 */
export function UpgradePrompt({
  message,
  ctaHref = "/verification",
  ctaLabel = "Verify your role",
}: {
  message?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center shadow-soft">
      <h3 className="text-lg font-semibold text-brand-900">Verification required</h3>
      <p className="mt-1 text-sm text-brand-800">
        {message ??
          "Posting reviews and voting requires a verified role so MyUniversityVerified stays accountable."}
      </p>
      <p className="mt-1 text-xs text-brand-700">
        Athlete · Athlete Alumni · Student · Parent. Pick the role that matches you.
      </p>
      <Link href={ctaHref} className="btn-primary mt-3 inline-flex">
        {ctaLabel}
      </Link>
    </div>
  );
}
