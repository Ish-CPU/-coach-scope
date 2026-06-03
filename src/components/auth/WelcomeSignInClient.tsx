"use client";

/**
 * Client half of the /welcome flow. Polls a small status endpoint until
 * the webhook has materialized the User from the PendingSignup, then
 * lets the user sign in with the password they just chose at signup.
 *
 * Why polling: there's a brief race window where Stripe redirects to
 * /welcome before our webhook handler runs. Trying to sign in during
 * that window would fail because the User row doesn't exist yet. We
 * poll every ~1.5s for up to 25s; in practice the webhook fires within
 * 1–3s of redirect.
 */
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Props {
  checkoutSessionId: string;
  prefillEmail: string;
}

type ReadyState = "checking" | "ready" | "timeout";

export function WelcomeSignInClient({ checkoutSessionId, prefillEmail }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [readyState, setReadyState] = useState<ReadyState>("checking");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll the status endpoint until the User exists (webhook done) OR we
  // give up. Once ready, the sign-in button enables and the "creating
  // your account…" hint disappears.
  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 25_000;

    async function tick(): Promise<void> {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/auth/post-checkout-status?cs=${encodeURIComponent(checkoutSessionId)}`,
          { cache: "no-store" }
        );
        const j: { ready?: boolean } = await res.json().catch(() => ({}));
        if (j.ready) {
          if (!cancelled) setReadyState("ready");
          return;
        }
      } catch {
        // Network blip — keep polling.
      }
      if (Date.now() > deadline) {
        if (!cancelled) setReadyState("timeout");
        return;
      }
      setTimeout(tick, 1500);
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setSigningIn(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setSigningIn(false);
    if (result?.error) {
      setError(
        readyState === "ready"
          ? "Sign-in failed. Double-check your password."
          : "Account is still being set up. Try again in a moment."
      );
      return;
    }
    router.push("/verification?checkout=success");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
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
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Same password you just chose"
        />
      </div>

      {readyState === "checking" && (
        <p className="rounded-lg bg-sky-50 p-2 text-xs text-sky-800">
          Creating your account from Stripe confirmation…
        </p>
      )}
      {readyState === "timeout" && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          Setup is taking a little longer than usual. You can still try to
          sign in — if it fails, refresh in a few seconds.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={signingIn || (readyState === "checking" && !error)}
      >
        {signingIn
          ? "Signing in…"
          : readyState === "checking"
          ? "Waiting for setup…"
          : "Sign in & continue"}
      </button>
    </form>
  );
}
