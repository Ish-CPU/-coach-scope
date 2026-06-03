/**
 * /welcome — landing page after a successful Stripe checkout when the
 * user came through the Account-on-Payment flow.
 *
 * Sequence:
 *   1. Stripe redirects here with ?cs=<checkout_session_id>
 *   2. We hit Stripe server-side to read the customer email tied to that
 *      session (avoids us trusting a URL param for the email).
 *   3. We render a client component that:
 *      a. Polls /api/auth/post-checkout-status?cs=<id> until the webhook
 *         has materialized the User OR a short deadline passes.
 *      b. Once ready, shows a sign-in form with the email pre-filled —
 *         the user enters the password they just chose at signup.
 *      c. On successful sign-in, redirects to /verification?checkout=success
 *         so they continue into the role-verification step.
 *
 * Why no auto-sign-in: setting a NextAuth session cookie outside the
 * normal credentials flow is hacky + risky. One re-entry of the
 * password is acceptable UX and keeps the auth surface minimal.
 */
import { stripe } from "@/lib/stripe";
import Link from "next/link";
import { WelcomeSignInClient } from "@/components/auth/WelcomeSignInClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ cs?: string }>;
}

export default async function WelcomePage(props: PageProps) {
  const { cs } = await props.searchParams;

  // No session id → someone hit /welcome directly. Send them home.
  if (!cs) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md card p-6 text-center">
          <h1 className="text-lg font-bold">Welcome page</h1>
          <p className="mt-2 text-sm text-slate-600">
            Looks like you got here without finishing checkout.{" "}
            <Link href="/pricing" className="text-brand-700 underline">
              Pick a plan
            </Link>{" "}
            to start.
          </p>
        </div>
      </div>
    );
  }

  // Look up the Stripe Checkout Session so we can show the user their
  // email and pre-fill the sign-in form. We do this server-side (with
  // our secret key) so a tampered URL can't spoof someone else's email.
  let emailFromStripe: string | null = null;
  let isPaid = false;
  try {
    const session = await stripe.checkout.sessions.retrieve(cs);
    // Common locations for the email:
    //   - customer_details.email (filled after Stripe collects it)
    //   - customer_email (legacy / pre-fill)
    emailFromStripe =
      session.customer_details?.email ??
      session.customer_email ??
      null;
    // A trialing or paid subscription both count as "checkout completed
    // successfully" — we surface a sign-in regardless. Stripe sets
    // `payment_status` to "no_payment_required" for trials.
    isPaid =
      session.status === "complete" ||
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
  } catch {
    // Bad session ID, expired, etc. Fall through with no email.
  }

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md card p-6">
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {isPaid ? (
            <>
              <p className="font-semibold">🎉 Your trial is live.</p>
              <p className="mt-1">
                Your 4-day free trial just started. Sign in below to verify
                your role and start participating.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Checkout received.</p>
              <p className="mt-1">
                We're setting up your account. Sign in to continue.
              </p>
            </>
          )}
        </div>

        <h1 className="text-lg font-bold">Sign in to continue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use the email and password you just chose at signup.
        </p>

        <WelcomeSignInClient
          checkoutSessionId={cs}
          prefillEmail={emailFromStripe ?? ""}
        />

        <p className="mt-4 text-xs text-slate-500">
          Just paid but the form isn't recognizing you? Account creation can
          take a few seconds after Stripe confirms — refresh in a moment.
        </p>
      </div>
    </div>
  );
}
