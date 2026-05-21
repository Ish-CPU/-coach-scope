"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import { PaymentIcons } from "@/components/PaymentIcons";
import { ROLE_DESCRIPTIONS } from "@/components/Badge";
import { cn } from "@/lib/cn";

type Interval = "MONTHLY" | "YEARLY";
type PaidRole =
  | "VERIFIED_ATHLETE"
  | "VERIFIED_STUDENT"
  | "VERIFIED_PARENT"
  | "VERIFIED_RECRUIT";
// "OTHER" maps to the VIEWER role in the DB — read-only spectator account
// that bypasses Stripe entirely. Kept distinct from PaidRole at the type
// level so the checkout / sign-up forwarding logic can't accidentally treat
// it like a paid tier.
type SelectableRole = PaidRole | "OTHER";

const PLANS: Record<Interval, { label: string; price: string; cadence: string; note: string }> = {
  MONTHLY: {
    label: "Monthly",
    price: "$5.99",
    cadence: "/month",
    note: "Billed every 30 days starting from your signup date.",
  },
  YEARLY: {
    label: "Yearly",
    price: "$55.99",
    cadence: "/year",
    // $5.99 × 12 = $71.88. $55.99 saves $15.89 (~22%) over paying monthly.
    note: "Save ~22% vs paying monthly ($55.99 annually, billed once a year).",
  },
};

// Visual order — paid tiers first, then "Other" (free) at the end so it
// reads as a fallback option, not the headline offer.
const ROLES: { value: SelectableRole; title: string; emoji: string; bullets: string[]; isFree?: boolean }[] = [
  // Order matters — surfaced left-to-right as the visible role grid. Recruit
  // comes FIRST so a high-school user landing on /pricing sees themselves
  // before any role they don't yet qualify for.
  {
    value: "VERIFIED_RECRUIT",
    title: "High School Recruit",
    emoji: "🎯",
    bullets: [
      "Submit Recruiting Experience reviews",
      "Rate how schools / coaches treated you during recruitment",
      "Access recruiting + transfer-portal groups",
      "Upgrade to Verified Athlete on the same account when you commit",
    ],
  },
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
  // Free spectator tier. Maps to UserRole.VIEWER in the DB. NO Stripe
  // checkout — selecting this routes the user straight to sign-up (if not
  // already signed in) or straight to /dashboard (if signed in).
  // Permissions are restricted server-side by canParticipate(); a VIEWER
  // can browse + search but cannot review, post, or verify.
  {
    value: "OTHER",
    title: "Other (Free)",
    emoji: "👀",
    isFree: true,
    bullets: [
      "Browse and read reviews",
      "No subscription required",
      "Cannot post reviews, vote, or join Verified Groups",
      "Upgrade to a verified role any time",
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
    if (!selectedRole) {
      setError("Choose a role to continue.");
      return;
    }

    // --- NOT signed in yet → forward to sign-up with the chosen tier
    //     baked into the URL. /sign-up reads ?plan + ?interval and
    //     resumes the flow after account creation. This is the canonical
    //     "tier first, account second" entry path.
    if (!session?.user) {
      const params = new URLSearchParams({ plan: selectedRole });
      if (selectedRole !== "OTHER") params.set("interval", interval);
      router.push(`/sign-up?${params.toString()}`);
      return;
    }

    // --- Signed in, picked OTHER (free) → no Stripe. Just set role +
    //     send them to the dashboard. Server-side /api/onboarding/role
    //     enforces what's allowed.
    if (selectedRole === "OTHER") {
      setError(null);
      setLoading(true);
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "VIEWER" }),
      });
      setLoading(false);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Could not save role.");
        return;
      }
      router.refresh();
      router.push("/dashboard");
      return;
    }

    // --- Signed in, picked a paid tier → start Stripe checkout.
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
          Anyone can browse MyUniversityVerified. Posting reviews, voting, and
          joining Verified Groups requires a verified subscription.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Participation requires a verified subscription to ensure real, accountable experiences.
        </p>
        <p className="mt-3 mx-auto max-w-xl text-sm text-slate-700">
          Your membership follows your journey — recruit, student, athlete,
          transfer, and alumni. One subscription, one account, every stage.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-5xl">
        {/* Step 1: choose a role */}
        <section className="card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">1. Choose your role</h2>
            {/* Inline interval toggle — moved up so the prices on each
                role card below reflect whichever cadence the user has in
                mind. The canonical control still lives below in Step 2;
                this toggle and that one share the same React state. */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Show prices as:</span>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                {(["MONTHLY", "YEARLY"] as Interval[]).map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInterval(i)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-medium transition",
                      interval === i
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {PLANS[i].label}
                    {i === "YEARLY" && (
                      <span className="ml-1 rounded-full bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-800">
                        save ~22%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                    : r.isFree
                    ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400"
                    : "border-slate-200 bg-white hover:border-brand-300"
                )}
                aria-pressed={selectedRole === r.value}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl leading-none">{r.emoji}</div>
                      {r.isFree && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                          Free
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{r.title}</h3>
                    {/* Price line — visible up-front so users see what
                        they're paying without scrolling. Updates with
                        the inline interval toggle above. Free tier
                        renders a distinct "Free forever" line so it
                        still anchors the column visually. */}
                    {r.isFree ? (
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-bold text-emerald-700">Free</span>
                        <span className="text-xs text-emerald-700/80">forever</span>
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-xl font-bold text-slate-900">
                            {PLANS[interval].price}
                          </span>
                          <span className="text-xs text-slate-500">
                            {PLANS[interval].cadence}
                          </span>
                        </div>
                        {/* Stripe Tax calculates the final amount at
                            checkout based on the user's billing
                            location. Surfaced on every paid card so
                            no one is surprised when they see a tax
                            line on the Stripe page. */}
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Taxes calculated at checkout
                        </p>
                      </>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {r.value === "OTHER"
                        ? "Read-only spectator. No subscription, no verification."
                        : ROLE_DESCRIPTIONS[r.value as UserRole]}
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
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 flex-none rounded-full",
                          r.isFree ? "bg-emerald-500" : "bg-brand-500"
                        )}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </section>

        {/* Recruit access — first-stop card for high school + transfer
            prospects. Lives directly below the role grid so a recruit who
            picks "High School Recruit" above sees what they get *and* what
            they unlock when they later commit. No separate Stripe product:
            recruits pay the same monthly/yearly price and convert to
            VERIFIED_ATHLETE on the same account when their verification
            request is approved. */}
        <section
          className="card mt-6 p-6"
          aria-labelledby="recruit-access-heading"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="recruit-access-heading"
              className="text-lg font-semibold"
            >
              Recruit access — start here
            </h2>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
              Same subscription
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Start as a recruit. Keep the same account when you become a student
            or athlete. One subscription, one verification history — your
            recruiting reviews stay with you through every later stage.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {/* High School Recruit */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl leading-none">🎯</div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    High School Recruit / Prospective Athlete
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Verified via recruiting proof: official visit, camp invite,
                    staff DM, recruiting questionnaire, offer letter, or
                    recruiting-profile link.
                  </p>
                </div>
                <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                  Verified Recruit
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Submit Recruiting Experience reviews for schools that
                    recruited you
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Rate how coaches and staff treated you during recruitment
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Post in recruiting groups + connect with current athletes /
                    parents
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-slate-400" />
                  <span className="text-slate-500">
                    Cannot review coach performance, team culture, dorms, or
                    campus life — you haven't lived them yet
                  </span>
                </li>
              </ul>
            </div>

            {/* Transfer Recruit */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl leading-none">🔁</div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    Transfer Recruit
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Already a college athlete being recruited by a new program?
                    Use the same Verified Recruit role for the program
                    recruiting you now.
                  </p>
                </div>
                <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                  Verified Recruit
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Submit Recruiting Experience reviews for the program
                    recruiting you
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Keep your existing athlete reviews of your former program
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Post in transfer-portal groups + alumni mentorship rooms
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>
                    Same account, same subscription — no second sign-up
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            When you commit / walk on / enroll, submit a Verified Athlete
            verification request — your existing reviews, groups, and
            subscription carry over automatically. No second account, no second
            payment.
          </p>
        </section>

        {/* Alumni access — included automatically.
            Lives between role selection and checkout so users see "I pick
            Athlete, alumni is automatic" exactly when they're deciding.
            No new Stripe products are involved — alumni access is granted
            via the existing role's permission set + the `isAlumni`
            lifecycle flag on User. See src/lib/lifecycle.ts. */}
        <section
          className="card mt-6 p-6"
          aria-labelledby="alumni-access-heading"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="alumni-access-heading"
              className="text-lg font-semibold"
            >
              Alumni access — included
            </h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              No extra cost
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            When you graduate or leave a roster, your account converts to alumni
            automatically. No second account. No separate subscription. Your
            existing Athlete or Student membership keeps working.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {/* Athlete Alumni */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl leading-none">🏅</div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    Athlete Alumni
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Included under your Verified Athlete subscription.
                  </p>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Verified Athlete Alumni
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Review former coaches, programs, NIL, and facilities</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Access former team and program communities</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Join alumni-only and transfer-portal mentorship groups</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Reviews stay weighted by your historical context</span>
                </li>
              </ul>
            </div>

            {/* Student Alumni */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl leading-none">🎓</div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    Student Alumni
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Included under your Verified Student subscription.
                  </p>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Verified Student Alumni
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Review former school, dorms, and student-life experience</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Access alumni and current-student communities</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Class-of-year badge appears on your profile + reviews</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand-500" />
                  <span>Verification persists — once verified, always verified</span>
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-500">
            Alumni status is a lifecycle flag on your account, not a separate
            plan. An admin or your own graduation flow flips it; your access,
            badges, and group eligibility update on the next page load.
          </p>
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
                    title="$5.99 × 12 = $71.88. $55.99/year saves $15.89."
                  >
                    save ~22%
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
          {/* Stripe Tax disclaimer — applies to paid tiers only. Free
              "Other" tier never reaches Stripe so it's tax-free by
              definition. Kept short + professional; the actual tax
              amount is computed and shown on Stripe Checkout based on
              the billing-address the user enters there. */}
          <p className="mt-1 text-[11px] text-slate-500">
            Prices shown do not include applicable taxes. Taxes are calculated
            at checkout based on your billing location.
          </p>

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
            disabled={loading || status === "loading" || (isActive && selectedRole !== "OTHER") || !selectedRole}
            onClick={startCheckout}
            className="btn-primary mt-6 w-full disabled:opacity-50"
          >
            {isActive && selectedRole !== "OTHER"
              ? "You're subscribed"
              : loading
              ? "Redirecting…"
              : !selectedRole
              ? "Choose a role above to continue"
              : selectedRole === "OTHER"
              ? // Free path — no Stripe involved. Copy makes that explicit
                // so users understand they won't see a payment form next.
                session?.user
                ? "Continue as Reader (Free) →"
                : "Sign up as Reader (Free) →"
              : session?.user
              ? `Subscribe — ${plan.price}${plan.cadence}`
              : `Sign up & subscribe — ${plan.price}${plan.cadence}`}
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

        {/* Who is membership for?
            Spelled out explicitly so each audience — including the alumni
            tiers, which don't have their own role card above — sees themselves
            on the page. The mapping in the right column tells them which
            existing role/subscription to pick. */}
        <section
          className="mt-6 card p-6"
          aria-labelledby="membership-for-heading"
        >
          <h2
            id="membership-for-heading"
            className="text-lg font-semibold"
          >
            Who is MyUniversityVerified membership for?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            One subscription, six audiences. Pick the role that matches your
            current stage — your access evolves automatically as your lifecycle
            changes.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
              <dt className="text-sm font-semibold text-slate-900">
                High School Recruits
              </dt>
              <dd className="mt-1 text-xs text-slate-600">
                Prospective athletes with verified recruiting proof (offer
                letter, camp invite, official visit, staff DM, recruiting
                profile). Write Recruiting Experience reviews. Pick "High
                School Recruit" at checkout — upgrade to Verified Athlete on
                the same account when you commit.
              </dd>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
              <dt className="text-sm font-semibold text-slate-900">
                Transfer Recruits
              </dt>
              <dd className="mt-1 text-xs text-slate-600">
                Current college athletes being recruited by a new program. Use
                the same Verified Recruit role for the new school while keeping
                your existing athlete reviews of your former program.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <dt className="text-sm font-semibold text-slate-900">
                Current Athletes
              </dt>
              <dd className="mt-1 text-xs text-slate-600">
                Active rostered athletes. Review coaches, programs, NIL,
                facilities, plus everything Students can. Post in athlete +
                program groups.
              </dd>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <dt className="text-sm font-semibold text-slate-900">
                Athlete Alumni
                <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Included
                </span>
              </dt>
              <dd className="mt-1 text-xs text-slate-600">
                Former rostered athletes. Same access as Verified Athletes,
                applied to your former coach / program / school. Pick "Verified
                Athlete" at checkout — alumni status flips on automatically
                later.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <dt className="text-sm font-semibold text-slate-900">
                Current Students
              </dt>
              <dd className="mt-1 text-xs text-slate-600">
                Enrolled at the university. Review schools, dorms, and campus
                life. Post in student communities.
              </dd>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <dt className="text-sm font-semibold text-slate-900">
                Student Alumni
                <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Included
                </span>
              </dt>
              <dd className="mt-1 text-xs text-slate-600">
                Graduates. Same access as Verified Students, applied to your
                former school + dorm + campus life. Pick "Verified Student" at
                checkout — alumni status flips on automatically later.
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
              <dt className="text-sm font-semibold text-slate-900">Parents</dt>
              <dd className="mt-1 text-xs text-slate-600">
                Submit structured parent insights. Post in parent communities.
                No numerical ratings — the parent perspective is qualitative.
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] text-slate-500">
            Transferring schools? Your former-school credibility stays attached
            to your profile, and your new school is added as a current
            connection — no upgrade, no new account.
          </p>
        </section>
      </div>
    </div>
  );
}
