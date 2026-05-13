"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RequestStatus } from "@prisma/client";

type Action = "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING";

interface Props {
  id: string;
  status: RequestStatus;
}

export function RequestActionButtons({ id, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: Action) {
    setError(null);
    const res = await fetch(`/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
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
