"use client";

/**
 * Client-only form for submitting a role-change request from
 * /account/settings. The card around it (RoleChangeCard) is a server
 * component that renders the user's current role + their request
 * history; this is the interactive piece.
 *
 * UX:
 *   - Button toggles the form open inline (no modal, less context-switch).
 *   - User picks one of the requestable roles + types a reason (10–2,000
 *     chars to match server schema).
 *   - On submit → POST /api/account/role-change. Success → router.refresh
 *     so the card's past-requests list picks up the new row.
 *   - On error, the API's error message renders inline. Special-cases
 *     `subscription_required` (404 redirect path to /pricing) and
 *     `already_pending` (clear remediation).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface RoleOption {
  value: string;
  label: string;
  hint: string;
}

// Mirrors the REQUESTABLE set in /api/account/role-change. Listed in
// the order users typically flow through: athlete-track first, then
// alumni variants, then student/parent.
const OPTIONS: RoleOption[] = [
  {
    value: "VERIFIED_ATHLETE",
    label: "Athlete (current)",
    hint: "Currently rostered on a college team.",
  },
  {
    value: "VERIFIED_ATHLETE_ALUMNI",
    label: "Athlete alumni",
    hint: "Former college athlete (graduated or no longer on roster).",
  },
  {
    value: "VERIFIED_RECRUIT",
    label: "Recruit",
    hint: "High-school athlete in the recruiting process.",
  },
  {
    value: "VERIFIED_STUDENT",
    label: "Student (current)",
    hint: "Currently enrolled at the university.",
  },
  {
    value: "VERIFIED_STUDENT_ALUMNI",
    label: "Student alumni",
    hint: "Former / graduated student.",
  },
  {
    value: "VERIFIED_PARENT",
    label: "Parent",
    hint: "Parent of an athlete or student.",
  },
];

interface Props {
  currentRole: string;
  /** True when the user has an ACTIVE/TRIALING/CANCELED sub. False
   *  hides the form and shows a pointer to /pricing instead — same
   *  paywall the API enforces, mirrored here for clean UX. */
  hasActiveSub: boolean;
  /** True when the user already has a PENDING request — disables the
   *  open button + shows a hint pointing at the history list. */
  hasPending: boolean;
}

export function RoleChangeRequestForm({ currentRole, hasActiveSub, hasPending }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestedRole, setRequestedRole] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!hasActiveSub) {
    return (
      <p className="text-sm text-slate-600">
        Role changes require an active subscription.{" "}
        <Link href="/pricing" className="text-brand-700 hover:underline">
          Start your free trial
        </Link>{" "}
        to switch roles.
      </p>
    );
  }

  if (hasPending) {
    return (
      <p className="text-sm text-slate-600">
        You already have a pending role-change request. Wait for an admin
        to review it (or contact support to withdraw) before opening a
        new one.
      </p>
    );
  }

  if (done) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Request submitted. An admin will review and email you. Your
        current role and subscription stay the same until they approve.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-sm"
      >
        Request role change
      </button>
    );
  }

  // Options minus the user's current role (you can't request your own role).
  const available = OPTIONS.filter((o) => o.value !== currentRole);
  const reasonLen = reason.trim().length;
  const canSubmit = !!requestedRole && reasonLen >= 10 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/role-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedRole, reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Couldn't submit.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          New role
        </label>
        <div className="mt-2 grid gap-2">
          {available.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                requestedRole === o.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="requestedRole"
                value={o.value}
                checked={requestedRole === o.value}
                onChange={() => setRequestedRole(o.value)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-slate-900">{o.label}</span>
                <span className="block text-xs text-slate-600">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="rc-reason" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Reason (10–2000 characters)
        </label>
        <textarea
          id="rc-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Tell the admin what changed — e.g. 'Graduated in May 2026, no longer on the roster.'"
          maxLength={2000}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          {reasonLen} / 2000 characters{reasonLen < 10 ? " — minimum 10" : ""}
        </p>
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
          className="btn-primary text-sm disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit request"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setRequestedRole("");
            setReason("");
          }}
          className="btn-ghost text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
