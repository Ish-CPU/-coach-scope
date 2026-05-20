"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "@/lib/legal-versions";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Both consents are required to enable the submit button — see also the
  // server-side check in /api/auth/register which rejects any request
  // missing the versions, so a tampered client can't bypass this.
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
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        // Send the EXACT version strings the user saw on this page —
        // server compares them against its canonical constants. If a
        // version bumps between page load and submit (unlikely), the
        // server rejects with a clear error.
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
    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="container-page flex flex-col items-center justify-center py-16">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Free forever to read. On the next step you&apos;ll pick your role
          (Athlete, Athlete Alumni, Student, Parent, or Other) and start verification.
        </p>
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

          {/* Legal consent — required. The version strings going to the
              server are sourced from src/lib/legal-versions.ts; the User
              row stores both the version AND the timestamp on success. */}
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
              I agree to MyUniversityVerified&apos;s{" "}
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
            {loading ? "Creating…" : "Create account"}
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
