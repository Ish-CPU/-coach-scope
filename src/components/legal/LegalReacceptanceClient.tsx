"use client";

/**
 * Client half of the legal re-acceptance gate. Renders a fixed-position
 * blocking modal that:
 *
 *   - explains which document(s) changed
 *   - links to the current versions in a new tab
 *   - requires a checkbox before the Accept button enables
 *   - POSTs to /api/legal/accept on submit
 *   - refreshes the page (so the gate disappears) on success
 *
 * Decline path is a sign-out — they can't use the app without
 * accepting the current terms.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";

interface Props {
  currentTermsVersion: string;
  currentPrivacyVersion: string;
  needsTerms: boolean;
  needsPrivacy: boolean;
}

export function LegalReacceptanceClient({
  currentTermsVersion,
  currentPrivacyVersion,
  needsTerms,
  needsPrivacy,
}: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acceptedTermsVersion: currentTermsVersion,
        acceptedPrivacyVersion: currentPrivacyVersion,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not save.");
      return;
    }
    // Re-render the tree — the gate's server check will now pass and
    // the modal will unmount.
    router.refresh();
  }

  const headline =
    needsTerms && needsPrivacy
      ? "Our Terms of Service and Privacy Policy have been updated"
      : needsTerms
      ? "Our Terms of Service have been updated"
      : "Our Privacy Policy has been updated";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-reacceptance-heading"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2
          id="legal-reacceptance-heading"
          className="text-lg font-bold text-slate-900"
        >
          {headline}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Please review and re-accept to continue using your account.
        </p>

        <ul className="mt-4 space-y-2 text-sm">
          {needsTerms && (
            <li>
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noopener"
                className="text-brand-700 underline hover:no-underline"
              >
                Read the updated Terms of Service →
              </Link>
            </li>
          )}
          {needsPrivacy && (
            <li>
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener"
                className="text-brand-700 underline hover:no-underline"
              >
                Read the updated Privacy Policy →
              </Link>
            </li>
          )}
        </ul>

        <label className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 cursor-pointer"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span className="text-slate-700">
            I have reviewed and agree to the updated{" "}
            {needsTerms && (
              <>
                <Link
                  href="/legal/terms"
                  target="_blank"
                  rel="noopener"
                  className="text-brand-700 underline hover:no-underline"
                >
                  Terms of Service
                </Link>
                {needsPrivacy ? " and " : ""}
              </>
            )}
            {needsPrivacy && (
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener"
                className="text-brand-700 underline hover:no-underline"
              >
                Privacy Policy
              </Link>
            )}
            .
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn-ghost"
            disabled={busy}
          >
            Decline &amp; sign out
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={!accepted || busy}
            className="btn-primary"
          >
            {busy ? "Saving…" : "Accept and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
