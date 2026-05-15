"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProofPreview } from "@/components/admin/ProofPreview";

/**
 * Generic connection row used by /admin/connections for both athlete and
 * student tables. The `kind` prop selects the right admin endpoint
 * (`/api/admin/connections/athlete/<id>` vs `…/student/<id>`); everything
 * else (proof URLs, statuses, approve/reject) is shared.
 */
export interface ConnectionDisplay {
  id: string;
  kind: "athlete" | "student";
  user: { id: string; name: string | null; email: string };
  university: { id: string; name: string; state: string | null };
  status: "PENDING" | "APPROVED" | "REJECTED";
  connectionType: string;
  sport?: string | null;
  schoolSport?: string | null;
  rosterUrl?: string | null;
  recruitingProofUrl?: string | null;
  studentIdUrl?: string | null;
  proofUrl?: string | null;
  schoolEmail?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function ConnectionRow({ row }: { row: ConnectionDisplay }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState(row.rejectionReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(row.status);

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !reasonOpen && !reason.trim()) {
      setReasonOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/connections/${row.kind}/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        rejectionReason: action === "reject" ? reason.trim() || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not update.");
      return;
    }
    setLocalStatus(action === "approve" ? "APPROVED" : "REJECTED");
    router.refresh();
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-slate-500">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {row.user.name ?? row.user.email}
          </div>
          <div className="mt-0.5">{row.user.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[localStatus] ?? "bg-slate-100 text-slate-700"}`}
          >
            {localStatus.toLowerCase()}
          </span>
          <span>{new Date(row.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <Cell label="University" value={row.university.name + (row.university.state ? ` · ${row.university.state}` : "")} />
        {row.kind === "athlete" && (
          <Cell label="Sport / program" value={row.schoolSport ?? row.sport ?? "—"} />
        )}
        <Cell label="Connection" value={row.connectionType.replace("_", " ").toLowerCase()} />
        {(row.startYear || row.endYear) && (
          <Cell
            label="Years"
            value={`${row.startYear ?? "?"}–${row.endYear ?? "present"}`}
          />
        )}
        {row.schoolEmail && <Cell label="School email" value={row.schoolEmail} />}
      </dl>

      {(row.rosterUrl ||
        row.recruitingProofUrl ||
        row.studentIdUrl ||
        row.proofUrl) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {row.rosterUrl && <ProofPreview label="Roster URL" url={row.rosterUrl} />}
          {row.recruitingProofUrl && (
            <ProofPreview label="Recruiting proof" url={row.recruitingProofUrl} />
          )}
          {row.studentIdUrl && (
            <ProofPreview label="Student ID / alumni doc" url={row.studentIdUrl} />
          )}
          {row.proofUrl && <ProofPreview label="Other proof" url={row.proofUrl} />}
        </div>
      )}

      {row.notes && (
        <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          <strong className="text-slate-700">Notes:</strong> {row.notes}
        </p>
      )}

      {row.rejectionReason && localStatus === "REJECTED" && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">
          <strong>Rejection reason:</strong> {row.rejectionReason}
        </p>
      )}

      {localStatus === "PENDING" && (
        <>
          {reasonOpen && (
            <div className="mt-3">
              <label className="label">Rejection reason (optional but recommended)</label>
              <textarea
                className="input min-h-[64px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Why is this being rejected? Shown to the user."
              />
            </div>
          )}
          {error && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => act("approve")} disabled={busy} className="btn-primary text-xs">
              {busy ? "Working…" : "Approve"}
            </button>
            <button
              onClick={() => act("reject")}
              disabled={busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {reasonOpen ? "Confirm reject" : "Reject…"}
            </button>
            {reasonOpen && (
              <button
                type="button"
                onClick={() => {
                  setReasonOpen(false);
                  setReason("");
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="truncate text-slate-800">{value}</dd>
    </div>
  );
}
