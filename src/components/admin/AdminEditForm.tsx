"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPermissions,
  PERMISSION_LABELS,
  AdminPermissionKey,
} from "@/lib/admin-permissions";
import { AdminRemovalReason, AdminStatus } from "@prisma/client";

interface Props {
  adminId: string;
  currentPermissions: AdminPermissions;
  currentStatus: AdminStatus;
  workEmail: string;
  currentRemovalReason: AdminRemovalReason | null;
  currentRemovalNote: string;
}

const STATUS_OPTIONS: { value: AdminStatus; label: string; tone: string }[] = [
  { value: AdminStatus.INVITED, label: "Invited (awaiting onboarding)", tone: "amber" },
  { value: AdminStatus.ACTIVE, label: "Active", tone: "emerald" },
  { value: AdminStatus.SUSPENDED, label: "Suspended (temporary block)", tone: "orange" },
  { value: AdminStatus.DISABLED, label: "Disabled (hard stop)", tone: "slate" },
  { value: AdminStatus.REMOVED, label: "Removed (archive — no access)", tone: "rose" },
];

const REASON_OPTIONS: { value: AdminRemovalReason; label: string }[] = [
  { value: AdminRemovalReason.QUIT, label: "Quit" },
  { value: AdminRemovalReason.TERMINATED, label: "Terminated" },
  { value: AdminRemovalReason.INACTIVITY, label: "Inactivity" },
  { value: AdminRemovalReason.POLICY_VIOLATION, label: "Policy violation" },
  { value: AdminRemovalReason.TEMPORARY_SUSPENSION, label: "Temporary suspension" },
  { value: AdminRemovalReason.OTHER, label: "Other (use note)" },
];

const BLOCKING: ReadonlySet<AdminStatus> = new Set([
  AdminStatus.DISABLED,
  AdminStatus.SUSPENDED,
  AdminStatus.REMOVED,
]);

/**
 * Master-only inline editor for a single staff admin. Actions:
 *   - Save changes  → PATCH /api/admin/team/[id]  (status, perms, work email, reason)
 *   - Reset password → POST /api/admin/team/[id]/reset-password
 *   - Resend invite  → POST /api/admin/team/[id]/resend-invite
 *   - Force logout   → POST /api/admin/team/[id]/force-logout
 *
 * Moving status into DISABLED / SUSPENDED / REMOVED automatically revokes
 * sessions server-side; the standalone Force-Logout button is for the
 * "active admin, kick their session anyway" case.
 */
export function AdminEditForm({
  adminId,
  currentPermissions,
  currentStatus,
  workEmail: initialWorkEmail,
  currentRemovalReason,
  currentRemovalNote,
}: Props) {
  const router = useRouter();
  const [perms, setPerms] = useState<AdminPermissions>({ ...currentPermissions });
  const [status, setStatus] = useState<AdminStatus>(currentStatus);
  const [workEmail, setWorkEmail] = useState(initialWorkEmail);
  const [removalReason, setRemovalReason] = useState<AdminRemovalReason | "">(
    currentRemovalReason ?? ""
  );
  const [removalNote, setRemovalNote] = useState(currentRemovalNote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ kind: "url" | "password"; value: string } | null>(null);

  const isBlocking = BLOCKING.has(status);
  const statusChanged = status !== currentStatus;

  async function call(
    path: string,
    init: RequestInit,
    onSuccess: (json: any) => void
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(path, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof json.error === "string" ? json.error : "Request failed.");
        return;
      }
      onSuccess(json);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function save() {
    return call(
      `/api/admin/team/${adminId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workEmail: workEmail || null,
          status,
          permissions: perms,
          removalReason: isBlocking ? removalReason || null : null,
          removalNote: isBlocking ? removalNote.trim() || null : null,
        }),
      },
      () =>
        setMessage(
          statusChanged && isBlocking
            ? `Saved — status set to ${status}. Active sessions were revoked.`
            : statusChanged
            ? `Saved — status set to ${status}.`
            : "Saved."
        )
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Profile & permissions</h3>

        <div>
          <label className="text-xs font-medium text-slate-600">
            Work email <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="email"
            className="input mt-1 w-full"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Status</label>
          <select
            className="input mt-1 w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Suspending, disabling, or removing immediately blocks sign-in, zeroes every
            permission, and revokes any active session. Removing is the terminal state —
            account stays in audit history but is archived.
          </p>
        </div>

        {/* Reason selector — only meaningful for blocking statuses. */}
        {isBlocking && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Reason</label>
              <select
                className="input mt-1 w-full"
                value={removalReason}
                onChange={(e) =>
                  setRemovalReason(e.target.value as AdminRemovalReason | "")
                }
              >
                <option value="">— select —</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Custom note <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                className="input mt-1 w-full"
                rows={2}
                value={removalNote}
                onChange={(e) => setRemovalNote(e.target.value)}
                placeholder="Anything you want logged alongside this status change."
              />
            </div>
          </div>
        )}

        <fieldset>
          <legend className="text-xs font-medium text-slate-600">Permissions</legend>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Permissions are still editable for blocked admins so a future
            Reactivate restores the right grants — but every check returns
            false while status is non-active.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(Object.keys(perms) as AdminPermissionKey[]).map((key) => {
              if (key === "canManageAdmins") return null;
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={perms[key]}
                    onChange={(e) =>
                      setPerms((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span>{PERMISSION_LABELS[key]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button type="button" disabled={busy} className="btn-primary" onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Credentials & sessions</h3>
        <p className="text-xs text-slate-500">
          Resetting the password also forces them through onboarding again. Resending
          the invite generates a fresh single-use token. Force-logout drops every
          active session immediately, even for ACTIVE admins.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="btn-secondary"
            onClick={() =>
              call(
                `/api/admin/team/${adminId}/reset-password`,
                { method: "POST" },
                (json) =>
                  setCredential({ kind: "password", value: json.temporaryPassword })
              )
            }
          >
            Reset password
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-secondary"
            onClick={() =>
              call(
                `/api/admin/team/${adminId}/resend-invite`,
                { method: "POST" },
                (json) => setCredential({ kind: "url", value: json.inviteUrl })
              )
            }
          >
            Resend invite
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-secondary"
            onClick={() =>
              call(
                `/api/admin/team/${adminId}/force-logout`,
                { method: "POST" },
                () => setMessage("Active sessions revoked.")
              )
            }
          >
            Force logout
          </button>
        </div>

        {credential && (
          <div className="mt-2">
            <label className="text-xs font-medium text-slate-600">
              {credential.kind === "url" ? "Invite URL" : "Temporary password"}
            </label>
            <input
              readOnly
              value={credential.value}
              className={`input mt-1 w-full ${
                credential.kind === "password" ? "font-mono" : ""
              }`}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Copy this now — we don't show it again.
            </p>
          </div>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          {message}
        </div>
      )}
    </div>
  );
}
