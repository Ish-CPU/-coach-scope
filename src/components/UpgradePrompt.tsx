"use client";

import Link from "next/link";

export function UpgradePrompt({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center shadow-soft">
      <h3 className="text-lg font-semibold text-brand-900">
        Verified subscription required
      </h3>
      <p className="mt-1 text-sm text-brand-800">
        {message ??
          "Participation requires a verified subscription to ensure real, accountable experiences."}
      </p>
      <p className="mt-1 text-xs text-brand-700">
        Pick your role at checkout — Athlete, Student, or Parent. Cancel anytime.
      </p>
      <Link href="/pricing" className="btn-primary mt-3 inline-flex">
        Choose your role &amp; subscribe
      </Link>
    </div>
  );
}
