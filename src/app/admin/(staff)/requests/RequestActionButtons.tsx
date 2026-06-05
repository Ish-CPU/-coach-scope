"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RequestStatus } from "@prisma/client";

type Action = "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING";

interface Props {
  id: string;
  status: RequestStatus;
  /** If true, this request has an email on file and the requester will
   *  receive a notification on approve/reject. Drives the prompt copy. */
  hasRequesterEmail: boolean;
}

export function RequestActionButtons({ id, status, hasRequesterEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: Action) {
    setError(null);
    // For terminal decisions (approve/reject) prompt for an admin note.
    // The server emails it to the requester verbatim, so the prompt
    // surfaces that fact when there's an email on file. Cancelling the
    // prompt cancels the action; an empty string sends with no note.
    let adminNote: string | undefined;
    if (next === "APPROVED" || next === "REJECTED") {
      const verb = next === "APPROVED" ? "approve" : "reject";
      const audience = hasRequesterEmail
        ? "The requester will get an email with this note included."
        : "No email on file — note is for internal record only.";
      const raw = prompt(
        `Add an optional note about why you ${verb} this request.\n\n${audience}\n\n(Leave blank to skip, click Cancel to abort.)`
      );
      if (raw === null) return; // admin cancelled — abort the whole thing
      adminNote = raw.trim() || undefined;
    }
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, adminNote }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Update failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  const disabled = pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={disabled || status === "APPROVED"}
          onClick={() => setStatus("APPROVED")}
          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          title="Mark approved (you've imported the school)"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={disabled || status === "NEEDS_REVIEW"}
          onClick={() => setStatus("NEEDS_REVIEW")}
          className="rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-40"
        >
          Needs review
        </button>
        <button
          type="button"
          disabled={disabled || status === "REJECTED"}
          onClick={() => setStatus("REJECTED")}
          className="rounded bg-slate-500 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-40"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
