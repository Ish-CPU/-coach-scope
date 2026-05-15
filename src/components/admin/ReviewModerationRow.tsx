"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ReviewModerationStatus,
  ReviewType,
  UserRole,
  VerificationStatus,
} from "@prisma/client";

interface CredibilityReason {
  key: string;
  weight: number;
  applied: boolean;
  note?: string;
}

interface Review {
  id: string;
  title: string | null;
  body: string;
  reviewType: ReviewType;
  overall: number;
  trustScore: number;
  riskScore: number;
  credibilityReason: unknown;
  moderationStatus: ReviewModerationStatus;
  createdAt: string | Date;
  author: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    verificationStatus: VerificationStatus;
    createdAt: string | Date;
    trustScore: number;
  };
  coach: { id: string; name: string } | null;
  school: {
    id: string;
    sport: string;
    university: { name: string } | null;
  } | null;
  university: { id: string; name: string } | null;
  dorm: { id: string; name: string } | null;
}

const STATUS_TONE: Record<ReviewModerationStatus, string> = {
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  FLAGGED: "bg-red-100 text-red-800",
  REMOVED: "bg-slate-200 text-slate-700",
};

/**
 * Single review row in the moderation queue. Renders the submission
 * + the scorer's credibility breakdown + four moderation actions.
 *
 * Optimistic UI: on success the row collapses to a "Resolved" stub
 * rather than re-querying the queue. Use the Refresh link to confirm
 * the underlying state.
 */
export function ReviewModerationRow({ review }: { review: Review }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const reasons = Array.isArray(review.credibilityReason)
    ? (review.credibilityReason as CredibilityReason[])
    : [];
  const appliedReasons = reasons.filter((r) => r.applied);

  const targetLabel =
    review.coach?.name
      ? `Coach: ${review.coach.name}`
      : review.school
      ? `Program: ${review.school.university?.name ?? ""} ${review.school.sport}`.trim()
      : review.university?.name
      ? `University: ${review.university.name}`
      : review.dorm?.name
      ? `Dorm: ${review.dorm.name}`
      : `Target: ${review.reviewType}`;

  async function action(verb: "approve" | "remove" | "mark_safe" | "needs_more_info") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/reviews/${review.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: verb, note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Action failed.");
      return;
    }
    const labelByVerb: Record<typeof verb, string> = {
      approve: "Approved",
      mark_safe: "Marked safe (published)",
      remove: "Removed",
      needs_more_info: "Marked as needing more info",
    };
    setResolved(labelByVerb[verb]);
    router.refresh();
  }

  if (resolved) {
    return (
      <div className="card flex items-center justify-between p-4 text-xs text-emerald-800">
        <span>{resolved}.</span>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="underline"
        >
          Refresh queue
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[review.moderationStatus]}`}
            >
              {review.moderationStatus.replace(/_/g, " ").toLowerCase()}
            </span>
            <span className="text-slate-500">
              risk{" "}
              <span className={review.riskScore >= 70 ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>
                {review.riskScore}
              </span>
              {" · "}
              author trust{" "}
              <span className="font-semibold text-emerald-700">
                {review.trustScore}
              </span>
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {targetLabel}
            {" · "}
            {review.reviewType.toLowerCase().replace("_", " ")}
            {" · "}
            overall {review.overall.toFixed(1)}/5
          </div>
        </div>
        <span className="text-[11px] text-slate-400">
          {new Date(review.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
        {review.title && (
          <div className="font-semibold text-slate-900">{review.title}</div>
        )}
        <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
          {review.body}
        </p>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-2">
          <div className="font-semibold text-slate-700">Author</div>
          <div className="mt-0.5 text-slate-600">
            {review.author.name || review.author.email}
          </div>
          <div className="text-slate-500">
            {review.author.role.toLowerCase()} ·{" "}
            {review.author.verificationStatus.toLowerCase()} · trust{" "}
            {review.author.trustScore}
          </div>
          <div className="text-slate-400">
            joined {new Date(review.author.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-2">
          <div className="font-semibold text-slate-700">Risk reasons</div>
          {appliedReasons.length === 0 ? (
            <div className="mt-0.5 text-slate-400">None tripped.</div>
          ) : (
            <ul className="mt-0.5 space-y-0.5 text-slate-600">
              {appliedReasons.map((r, i) => (
                <li key={`${r.key}-${i}`}>
                  • <span className="font-mono text-[10px]">{r.key}</span>
                  {r.weight > 0 && (
                    <span className="text-slate-400"> +{r.weight}</span>
                  )}
                  {r.note && (
                    <span className="text-slate-500"> — {r.note}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {showNote && (
        <div className="mt-3">
          <label className="text-[11px] font-medium text-slate-600">
            Optional admin note (attached to the review's history)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            className="input mt-1 w-full text-xs"
            placeholder="Why approving / removing / needing more info?"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="text-[11px] text-slate-500 hover:underline"
        >
          {showNote ? "Hide note" : "Add note"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => action("needs_more_info")}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Needs more info
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => action("mark_safe")}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
        >
          Mark safe
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => action("approve")}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Approve & publish
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => action("remove")}
          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
