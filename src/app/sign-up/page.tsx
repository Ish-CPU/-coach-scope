"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-versions";

/**
 * Sign-up — second step of the canonical entry flow.
 *
 * The user MUST come through /pricing first. They pick a tier
 * (paid role OR free "OTHER" spectator), then land here with
 * `?plan=<tier>&interval=<MONTHLY|YEARLY>` in the URL. After we create
 * the account + auto-sign-in, we read those params and dispatch:
 *
 *   plan=OTHER          → POST /api/onboarding/role { role: "VIEWER" } → /dashboard
 *   plan=<paid role>    → POST /api/onboarding/role { role: plan } → POST /api/stripe/checkout → Stripe
 *   no plan (deep link) → /onboarding (legacy fallback)
 *
 * Doing both the role-set AND the Stripe-checkout-start here means the
 * user never has to come back to /pricing to "finish" anything — the
 * sign-up button takes them straight where they need to go.
 */

const VALID_PAID_PLANS = new Set([
  "VERIFIED_ATHLETE",
  "VERIFIED_STUDENT",
  "VERIFIED_PARENT",
  "VERIFIED_RECRUIT",
]);
const VALID_INTERVALS = new Set(["MONTHLY", "YEARLY"]);

function SignUpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tier intent passed in from /pricing. Whitelisted before use so a
  // tampered URL can't push the user toward an unsupported role string.
  const rawPlan = searchParams.get("plan");
  const plan: string | null =
    rawPlan === "OTHER" || (rawPlan && VALID_PAID_PLANS.has(rawPlan))
      ? rawPlan
      : null;
  const rawInterval = searchParams.get("interval");
  const interval: "MONTHLY" | "YEARLY" =
    rawInterval && VALID_INTERVALS.has(rawInterval)
      ? (rawInterval as "MONTHLY" | "YEARLY")
      : "MONTHLY";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptedLegal) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);

    // 1. Create the account.
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error?.formErrors?.[0] ?? j.error ?? "Could not create account.");
      setLoading(false);
      return;
    }

    // 2. Auto-sign in so subsequent /api/onboarding/role + /api/stripe/checkout
    //    calls have a valid session cookie. Without this, both endpoints
    //    would 401 immediately.
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (signInResult?.error) {
      // Account was created but sign-in failed — surface a recoverable
      // error pointing them at /sign-in rather than leaving them stuck.
      setError("Account created. Please sign in to continue.");
      setLoading(false);
      router.push("/sign-in");
      return;
    }

    // 3. Dispatch based on the tier they picked at /pricing.
    if (plan === "OTHER") {
      // Free spectator path — set VIEWER role, skip Stripe entirely.
      await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "VIEWER" }),
      });
      router.refresh();
      router.push("/dashboard");
      return;
    }

    if (plan && VALID_PAID_PLANS.has(plan)) {
      // Paid path — stamp the chosen role on the user, then start Stripe
      // checkout. The role-set is intentionally separate from Stripe so
      // even if the user abandons checkout we already know what tier
      // they wanted (useful for win-back emails later).
      await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: plan }),
      });
      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval, selectedRole: plan }),
      });
      const j = await checkout.json().catch(() => ({}));
      if (j.url) {
        window.location.href = j.url;
        return;
      }
      // Stripe failed — leave them on the verification page so they can
      // re-try checkout from there OR continue with manual verification.
      setError(
        typeof j.error === "string"
          ? j.error
          : "Account created, but checkout failed. Open /pricing to retry."
      );
      setLoading(false);
      router.push("/verification");
      return;
    }

    // 4. No plan param at all (someone landed on /sign-up directly).
    //    Send them to /onboarding for the legacy role-picker flow.
    router.refresh();
    router.push("/onboarding");
  }

  const planLabel =
    plan === "OTHER"
      ? "Other (Free)"
      : plan === "VERIFIED_ATHLETE"
      ? "Verified Athlete"
      : plan === "VERIFIED_STUDENT"
      ? "Verified Student"
      : plan === "VERIFIED_PARENT"
      ? "Verified Parent"
      : plan === "VERIFIED_RECRUIT"
      ? "High School Recruit"
      : null;

  return (
    <div className="container-page flex flex-col items-center justify-center py-16">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-bold">Create your account</h1>
        {planLabel ? (
          <p className="mt-1 text-sm text-slate-600">
            You picked <strong>{planLabel}</strong> on the previous step.{" "}
            {plan === "OTHER"
              ? "Sign up below — no payment required."
              : "Sign up below — you'll continue to secure checkout."}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Free forever to read. On the next step you'll pick your role and
            (if applicable) complete verification.
          </p>
        )}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              required
              aria-describedby="legal-consent-description"
            />
            <span id="legal-consent-description" className="text-slate-700">
              I agree to MyUniversityVerified's{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noopener"
                className="text-brand-700 underline hover:no-underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener"
                className="text-brand-700 underline hover:no-underline"
              >
                Privacy Policy
              </Link>
              . I understand reviews I submit reflect my own opinions and
              that I am responsible for their content.
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            className="btn-primary w-full"
            disabled={loading || !acceptedLegal}
          >
            {loading
              ? "Creating…"
              : plan === "OTHER"
              ? "Create account & continue"
              : plan
              ? "Create account & continue to checkout"
              : "Create account"}
          </button>
        </form>
        <div className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-brand-700 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

// useSearchParams must be wrapped in <Suspense> in the App Router or the
// build complains about CSR bailout. The fallback is intentionally
// invisible — the form mounts in <50ms in practice.
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpInner />
    </Suspense>
  );
}
