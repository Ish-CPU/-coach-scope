"use client";

/**
 * Delete-account card on /account/settings. Renders nothing for admin
 * roles (admin lifecycle lives in /admin/team).
 *
 * Three-stage UX so accidental deletion is essentially impossible:
 *   1. Default closed — single red "Delete account" button.
 *   2. Click opens an inline panel with the consequences spelled out,
 *      a password field, a confirmation-phrase text field, and an
 *      optional reason textarea.
 *   3. Submit POSTs /api/account/delete. On success, signs the user
 *      out and bounces to a "your account has been deleted" page
 *      (we just route to the home page with a flag — easier than a
 *      dedicated route and the email confirms the action).
 */
import { useState } from "react";
import { signOut } from "next-auth/react";

const CONFIRMATION_PHRASE = "DELETE my account";

interface Props {
  userRole: string;
  /** Cached subscriptionStatus from the page server-render. We use it to
   *  warn the user up-front when they have an unpaid balance — the API
   *  re-checks live Stripe state at delete time as the source of truth. */
  subscriptionStatus: string;
}

export function DeleteAccountSection({ userRole, subscriptionStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin accounts shouldn't see this control. The API also rejects
  // them, but hiding the UI keeps things clear.
  if (userRole === "ADMIN" || userRole === "MASTER_ADMIN") {
    return null;
  }

  // Past-due users can't delete until they settle the outstanding
  // invoice. We surface this BEFORE they type their password to fail
  // fast and reduce confusion. The API re-checks live with Stripe so
  // a stale cached "PAST_DUE" can't be the basis for accidentally
  // letting someone through.
  const pastDue = subscriptionStatus === "PAST_DUE";

  const canSubmit =
    password.length > 0 && confirmation === CONFIRMATION_PHRASE && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        confirmation,
        reason: reason.trim() || undefined,
      }),
    });
    if (!res.ok) {
      setBusy(false);
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Deletion failed.");
      return;
    }
    // Force sign-out so the (now-invalid) session is dropped from the
    // client. callbackUrl lands them on the homepage; the confirmation
    // email arrives via Resend so they have a record.
    await signOut({ callbackUrl: "/?account=deleted" });
  }

  return (
    <section className="card mt-8 border-red-200 p-6">
      <header>
        <h2 className="text-lg font-bold text-red-800">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600">
          Permanently delete your MyUniversityVerified account. Your
          reviews and votes stay on the site but are shown as
          &ldquo;Former member.&rdquo; Your subscription is cancelled
          immediately and your personal data is removed.
        </p>
      </header>

      {pastDue && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Settle your outstanding balance first.</p>
          <p className="mt-1 text-xs">
            Your last payment was declined and your subscription is past
            due. We can&rsquo;t delete the account until the invoice is
            paid — otherwise the unpaid balance would be lost. Update
            your card or pay the invoice from the billing portal above,
            then come back here.
          </p>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pastDue}
          title={pastDue ? "Settle past-due balance first" : undefined}
          className="mt-4 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white"
        >
          Delete account
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p className="font-semibold">This cannot be undone.</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              <li>Your subscription is cancelled immediately — no further charges.</li>
              <li>Your name, email, password, profile photo, bio, and connections are removed.</li>
              <li>Reviews and votes you posted remain on the site as &ldquo;Former member.&rdquo;</li>
              <li>Payment history and verification records are retained for legal &amp; fraud reasons.</li>
              <li>You can sign up again with the same email — it will be a fresh account.</li>
            </ul>
          </div>

          <div>
            <label htmlFor="del-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Confirm your password
            </label>
            <input
              id="del-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label htmlFor="del-confirm" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Type <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">{CONFIRMATION_PHRASE}</code> to confirm
            </label>
            <input
              id="del-confirm"
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder={CONFIRMATION_PHRASE}
            />
          </div>

          <div>
            <label htmlFor="del-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reason (optional)
            </label>
            <textarea
              id="del-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="What pushed you to leave? Helps us improve."
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setPassword("");
                setConfirmation("");
                setReason("");
              }}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
