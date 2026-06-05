"use client";

/**
 * One row in /admin/role-changes. Renders the user + the diff + reason,
 * and (for actionable rows + permitted admins) inline approve/reject
 * buttons. Approve and reject both prompt for an optional adminNote
 * before firing — surfaced back to the user on their request history.
 *
 * Refreshes the server-rendered table via router.refresh() so badges
 * + counts update without a full page reload.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionStatus: string;
  verificationStatus: string;
}

interface Request {
  id: string;
  currentRole: string;
  requestedRole: string;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  user: UserSummary;
}

interface Props {
  request: Request;
  canAct: boolean;
}

function friendlyRole(r: string): string {
  return r.replace(/_/g, " ").toLowerCase();
}

function statusPill(s: string): JSX.Element {
  const cls =
    s === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : s === "REJECTED"
      ? "bg-slate-200 text-slate-700"
      : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {s.toLowerCase()}
    </span>
  );
}

export function RoleChangeRow({ request, canAct }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = request.status === "PENDING";
  const actionable = isPending && canAct;

  async function act(action: "approve" | "reject") {
    if (!actionable || busy) return;
    const noteLabel =
      action === "approve"
        ? `Approve role change to ${friendlyRole(request.requestedRole)}?\n\nOptional note (shown to user, leave blank to skip):`
        : `Reject this request?\n\nOptional reason (shown to user, leave blank to skip):`;
    const adminNote = prompt(noteLabel) ?? "";
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/role-changes/${request.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        adminNote: adminNote.trim() || undefined,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(
        typeof j.error === "string"
          ? j.error
          : `Couldn't ${action} the request. Refresh and try again.`
      );
      return;
    }
    router.refresh();
  }

  return (
    <tr className="text-sm align-top">
      <td className="px-2 py-3">
        <div className="font-medium text-slate-900">
          {request.user.name ?? "—"}
        </div>
        <div className="text-xs text-slate-600">{request.user.email}</div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-slate-500">
          <span>sub: {request.user.subscriptionStatus.toLowerCase()}</span>
          <span>verif: {request.user.verificationStatus.toLowerCase()}</span>
        </div>
      </td>
      <td className="px-2 py-3 text-slate-700">
        <span className="text-slate-500">{friendlyRole(request.currentRole)}</span>
        <span className="mx-1 text-slate-400">→</span>
        <span className="font-medium text-slate-900">
          {friendlyRole(request.requestedRole)}
        </span>
      </td>
      <td className="px-2 py-3 text-slate-700">
        <p className="max-w-md whitespace-pre-wrap">{request.reason}</p>
        {request.adminNote && !isPending && (
          <p className="mt-2 max-w-md rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
            <span className="font-semibold">Admin note:</span> {request.adminNote}
          </p>
        )}
      </td>
      <td className="px-2 py-3">{statusPill(request.status)}</td>
      <td className="px-2 py-3 text-xs text-slate-500">
        {request.createdAt.slice(0, 10)}
      </td>
      <td className="px-2 py-3 text-right">
        {actionable ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => act("approve")}
              disabled={!!busy}
              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => act("reject")}
              disabled={!!busy}
              className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-50"
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
        {error && (
          <p className="mt-1 text-[10px] text-red-700">{error}</p>
        )}
      </td>
    </tr>
  );
}
