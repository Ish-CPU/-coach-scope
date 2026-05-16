"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { PaymentIcons } from "@/components/PaymentIcons";
import { ROLE_DESCRIPTIONS } from "@/components/Badge";
import { cn } from "@/lib/cn";

type Interval = "MONTHLY" | "YEARLY";
type SelectableRole = "VERIFIED_ATHLETE" | "VERIFIED_STUDENT" | "VERIFIED_PARENT";

const PLANS: Record<Interval, { label: string; price: string; cadence: string; note: string }> = {
  MONTHLY: {
    label: "Monthly",
    price: "$5.99",
    cadence: "/month",
    note: "Billed every 30 days starting from your signup date.",
  },
  YEARLY: {
    label: "Yearly",
    price: "$55",
    cadence: "/year",
    // $5.99 × 12 = $71.88. $55 saves $16.88 (~23%) over paying monthly.
    note: "Save ~23% vs paying monthly ($55 annually, billed once a year).",
  },
};

const ROLES: { value: SelectableRole; title: string; emoji: string; bullets: string[] }[] = [
  {
    value: "VERIFIED_ATHLETE",
    title: "Verified Athlete",
    emoji: "🏋️",
    bullets: [
      "Rate coaches, programs, NIL, food, facilities",
      "Rate universities and dorms",
      "Post in Athlete Groups",
    ],
  },
  {
    value: "VERIFIED_STUDENT",
    title: "Verified Student",
    emoji: "🎓",
    bullets: [
      "Rate universities, dorms, and campus life",
      "Post in Student Groups",
      "Cannot rate coaches",
    ],
  },
  {
    value: "VERIFIED_PARENT",
    title: "Verified Parent",
    emoji: "👨‍👩‍👦",
    bullets: [
      "Submit structured parent insights",
      "Post in Parent Groups",
      "Cannot submit numerical ratings",
    ],
  },
];

const INCLUDES = [
  "Access Verified Groups (audience-segmented)",
  "Anonymous public posts, identity-protected by verification",
  "Save favorites and helpful votes",
  // Lifecycle promise — your subscription follows you. We deliberately do
  // NOT list "alumni" as a separate tier because alumni access is included
  // automatically in the underlying role (see src/lib/lifecycle.ts).
  "Your membership and profile evolve with your academic and athletic journey",
  "Alumni access included — review former coaches, programs, and campus life",
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [interval, setInterval] = useState<Interval>("MONTHLY");
  const [selectedRole, setSelectedRole] = useState<SelectableRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!session?.user) {
      router.push(`/sign-in?callbackUrl=/pricing`);
      return;
    }
    if (!selectedRole) {
      setError("Choose a role to continue.");
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval, selectedRole }),
    });
    const j = await res.json();
    setLoading(false);
    if (j.url) {
      window.location.href = j.url;
    } else {
      setError(j.error ?? "Could not start checkout.");
    }
  }

  const isActive = session?.user?.subscriptionStatus === "ACTIVE";
  const plan = PLANS[interval];

  return (
    <div className="container-page py-12">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Read free. Participate verified.
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Anyone can browse RateMyU. Posting reviews, voting, and joining Verified Groups
          requires a verified subscription.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Participation requires a verified subscription to ensure real, accountable experiences.
        </p>
        <p className="mt-3 mx-auto max-w-xl text-sm text-slate-600">
          One subscription covers every stage — recruit, current athlete or student,
          and alumni. Your profile and group access update automatically as your
          lifecycle changes; no new account required.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        {/* Step 1: choose a role */}
        <section className="card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">1. Choose your role</h2>
            <span className="text-xs text-slate-500">Required before checkout</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setSelectedRole(r.value);
                  setError(null);
                }}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  selectedRole === r.value
                    ? "border-brand-600 bg-brand-50 ring-2 ring-brand-200"
                    : "border-slate-200 bg-white hover:border-brand-300"
                )}
                aria-pressed={selectedRole === r.value}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-2xl leading-none">{r.emoji}</div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{r.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {ROLE_DESCRIPTIONS[r.value as UserRole]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "mt-1 h-4 w-4 rounded-full border",
                      selectedRole === r.value
                        ? "border-brand-600 bg-brand-600"
                        : "border-slate-300 bg-white"
                    )}
                    aria-hidden
                  />
                </div>
                <ul className="mt-3 space-y-1 text-xs text-slate-700">
                  {r.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: pick interval + checkout */}
        <section className="card mt-6 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">2. Pick a billing interval</h2>
          </div>

          <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-sm">
            {(["MONTHLY", "YEARLY"] as Interval[]).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                className={`rounded-full px-3 py-1 transition ${
                  interval === i
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {PLANS[i].label}
                {i === "YEARLY" && (
                  <span
                    className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800"
                    title="$5.99 × 12 = $71.88. $55/year saves $16.88."
                  >
                    save ~23%
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-baseline gap-1">
            <div className="text-3xl font-bold">{plan.price}</div>
            <div className="text-base font-medium text-slate-500">{plan.cadence}</div>
          </div>
          <p className="text-xs text-slate-500">{plan.note}</p>

          <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            {INCLUDES.map((x) => (
              <li key={x} className="flex items-start gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-none text-emerald-600">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 00-1.4-1.4L8 11.1 4.7 7.8a1 1 0 10-1.4 1.4l4 4a1 1 0 001.4 0l8-8z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{x}</span>
              </li>
            ))}
          </ul>

          <button
            disabled={loading || status === "loading" || isActive || !selectedRole}
            onClick={startCheckout}
            className="btn-primary mt-6 w-full disabled:opacity-50"
          >
            {isActive
              ? "You're subscribed"
              : loading
              ? "Redirecting…"
              : !selectedRole
              ? "Choose a role above to continue"
              : `Subscribe — ${plan.price}${plan.cadence}`}
          </button>

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>
          )}

          <div className="mt-4">
            <p className="text-xs text-slate-600">
              Pay securely with card, Apple Pay, or Google Pay.
            </p>
            <PaymentIcons className="mt-2" />
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Cancel anytime. Powered by Stripe. After payment you'll be guided to your role-specific
            verification step.
          </p>
        </section>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          Posts and reviews are shown publicly under anonymous handles such as “Anonymous Verified
          Athlete” — but every account is verified and tracked internally to reduce fake accounts and abuse.
        </div>
      </div>
    </div>
  );
}
