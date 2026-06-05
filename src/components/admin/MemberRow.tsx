"use client";

/**
 * One row in the /admin/members table.
 *
 * Status pills are deliberately compact so a wide table fits on a
 * laptop screen. The "Mark verified" button is the one piece of real
 * write functionality on this page — POSTs to
 * /api/admin/users/[id]/manual-verify, which flips
 * verificationStatus → VERIFIED and audit-logs the action.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  role: string;
  verificationStatus: string;
  subscriptionStatus: string;
  paymentVerified: boolean;
  hasStripeCustomer: boolean;
  hasStripeSub: boolean;
  createdAt: string;
  submittedRequests: number;
}

interface Props {
  user: UserSummary;
}

function shortDate(iso: string): string {
  // YYYY-MM-DD — compact, sortable visually.
  return iso.slice(0, 10);
}

function rolePill(role: string): JSX.Element {
  const friendly =
    role === "VIEWER" ? "Other (free)" : role.replace(/_/g, " ").toLowerCase();
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      {friendly}
    </span>
  );
}

function verifPill(status: string): JSX.Element {
  const cls =
    status === "VERIFIED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "REJECTED"
      ? "bg-red-100 text-red-800"
      : status === "PENDING"
      ? "bg-amber-100 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {status.toLowerCase()}
    </span>
  );
}

function subPill(status: string): JSX.Element {
  const cls =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-800"
      : status === "TRIALING"
      ? "bg-sky-100 text-sky-800"
      : status === "CANCELED"
      ? "bg-amber-100 text-amber-800"
      : status === "PAST_DUE"
      ? "bg-red-100 text-red-800"
      : status === "EXPIRED"
      ? "bg-slate-200 text-slate-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {status === "FREE" ? "no sub" : status.toLowerCase()}
    </span>
  );
}

export function MemberRow({ user }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyVerified = user.verificationStatus === "VERIFIED";

  async function markVerified() {
    if (alreadyVerified || busy) return;
    if (
      !confirm(
        `Mark ${user.email} as VERIFIED?\n\nThis flips their verificationStatus → VERIFIED without requiring them to submit proof. Use only for users you personally vouch for.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}/manual-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not verify.");
      return;
    }
    setDone(true);
    // Refresh the server-rendered row so badges update without a full page reload.
    router.refresh();
  }

  return (
    <tr className="text-sm">
      <td className="px-3 py-2 align-top">
        <div className="font-medium text-slate-900">{user.name ?? "—"}</div>
        <div className="text-xs text-slate-600">{user.email}</div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-400">
          {user.hasStripeCustomer && <span>customer ✓</span>}
          {user.hasStripeSub && <span>sub ✓</span>}
        </div>
      </td>
      <td className="px-3 py-2 align-top">{rolePill(user.role)}</td>
      <td className="px-3 py-2 align-top">{verifPill(user.verificationStatus)}</td>
      <td className="px-3 py-2 align-top">{subPill(user.subscriptionStatus)}</td>
      <td className="px-3 py-2 align-top text-xs text-slate-600">
        {shortDate(user.createdAt)}
      </td>
      <td className="px-3 py-2 align-top text-xs text-slate-600">
        {user.submittedRequests}
      </td>
      <td className="px-3 py-2 align-top text-right">
        <div className="flex justify-end gap-2">
          {user.submittedRequests > 0 && (
            <Link
              href={`/admin/verifications?status=ALL`}
              className="text-xs text-brand-700 hover:underline"
              title="Open the verification queue to act on this user's submitted request"
            >
              Queue
            </Link>
          )}
          {alreadyVerified ? (
            <span className="text-xs text-emerald-700">✓ Verified</span>
          ) : done ? (
            <span className="text-xs text-emerald-700">✓ Just verified</span>
          ) : (
            <button
              type="button"
              onClick={markVerified}
              disabled={busy}
              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Mark verified"}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-[10px] text-red-700">{error}</p>
        )}
      </td>
    </tr>
  );
}
