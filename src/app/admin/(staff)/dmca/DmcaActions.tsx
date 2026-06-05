"use client";

/**
 * Inline action buttons on each DMCA queue row. Different action set
 * per kind + status:
 *   TAKEDOWN + PENDING        → "Remove content" | "Reject"
 *   COUNTER_NOTICE + PENDING  → "Acknowledge" (moves to COUNTER_RECEIVED) | "Reject"
 *                              (actually we set to COUNTER_RECEIVED on
 *                               submission via the restore-content flow
 *                               below, but if admin needs to manually
 *                               nudge it that's a future-proof button)
 *   COUNTER_RECEIVED          → "Restore content" (only after eligibleAt) | "Reject"
 *
 * Each action prompts for an optional actionTaken note (internal,
 * never emailed) describing what we did about the content. The admin
 * note (which CAN be surfaced to the submitter later) is a separate
 * prompt to keep the two intents clean.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  kind: "TAKEDOWN" | "COUNTER_NOTICE";
  status: "PENDING" | "COUNTER_RECEIVED";
  /** ISO string or null. When in the future, restore is disabled. */
  counterEligibleToRestoreAt: string | null;
}

export function DmcaActions({ id, kind, status, counterEligibleToRestoreAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligibleAt = counterEligibleToRestoreAt
    ? new Date(counterEligibleToRestoreAt)
    : null;
  const canRestoreNow = !eligibleAt || eligibleAt <= new Date();

  async function act(action: "remove_content" | "restore_content" | "reject") {
    if (busy) return;
    const actionLabel =
      action === "remove_content"
        ? "remove the content"
        : action === "restore_content"
        ? "restore the content"
        : "reject the notice";

    const actionTaken = prompt(
      `Briefly describe what you did (internal note, e.g. "Removed review abc123"):`
    );
    if (actionTaken === null) return; // cancelled

    const adminNote = prompt(
      `Optional note about why you decided to ${actionLabel}. Leave blank to skip.`
    );
    if (adminNote === null) return; // cancelled

    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/dmca/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        actionTaken: actionTaken.trim() || undefined,
        adminNote: adminNote.trim() || undefined,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Action failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {kind === "TAKEDOWN" && status === "PENDING" && (
        <button
          type="button"
          onClick={() => act("remove_content")}
          disabled={!!busy}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "remove_content" ? "Removing…" : "Remove content"}
        </button>
      )}
      {kind === "COUNTER_NOTICE" && status === "COUNTER_RECEIVED" && (
        <button
          type="button"
          onClick={() => act("restore_content")}
          disabled={!!busy || !canRestoreNow}
          title={
            canRestoreNow
              ? undefined
              : `Statutory waiting period active until ${eligibleAt?.toISOString().slice(0, 10)}`
          }
          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "restore_content"
            ? "Restoring…"
            : canRestoreNow
            ? "Restore content"
            : "Restore (waiting period)"}
        </button>
      )}
      <button
        type="button"
        onClick={() => act("reject")}
        disabled={!!busy}
        className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-50"
      >
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </button>
      {error && <p className="basis-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
