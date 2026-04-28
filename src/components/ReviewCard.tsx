"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";
import { RatingStars } from "@/components/RatingStars";
import { RATING_LABELS } from "@/lib/review-schemas";
import { convertRatingToLetterGrade, convertRatingToPercentage } from "@/lib/review-weighting";
import { anonymousDisplayName } from "@/lib/anonymous";
import type { ReviewType, UserRole, VerificationStatus } from "@prisma/client";

export interface ReviewCardData {
  id: string;
  reviewType: ReviewType;
  title?: string | null;
  body: string;
  ratings: Record<string, number>;
  overall: number;
  helpfulCount: number;
  createdAt: string | Date;
  author: {
    id: string;
    role: UserRole;
    verificationStatus: VerificationStatus;
  };
}

export function ReviewCard({ review, canInteract }: { review: ReviewCardData; canInteract: boolean }) {
  const [helpful, setHelpful] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function vote() {
    if (!canInteract) return;
    const res = await fetch(`/api/reviews/${review.id}/helpful`, { method: "POST" });
    if (!res.ok) return;
    const j = await res.json();
    setHelpful((c) => c + (j.toggled === "on" ? 1 : -1));
    setVoted(j.toggled === "on");
  }

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span className="font-medium">{anonymousDisplayName(review.author.role)}</span>
            <Badge role={review.author.role} compact />
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</span>
          </div>
          {review.title && <h3 className="mt-1 text-base font-semibold text-slate-900">{review.title}</h3>}
        </div>
        <div className="shrink-0 text-right">
          <RatingStars value={review.overall} />
          <div className="text-xs text-slate-500">
            {review.overall > 0
              ? `${review.overall.toFixed(1)} / 5 · ${convertRatingToPercentage(review.overall)}% · ${convertRatingToLetterGrade(review.overall)}`
              : "Not rated"}
          </div>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">{review.body}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {Object.entries(review.ratings).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-slate-500">{RATING_LABELS[k] ?? k}</dt>
            <dd className="font-medium text-slate-700">
              {Number.isFinite(Number(v)) ? Number(v).toFixed(1) : "—"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <button
          onClick={vote}
          disabled={!canInteract}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            voted ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700"
          } disabled:opacity-50`}
        >
          👍 Helpful · {helpful}
        </button>
        <button onClick={() => setReportOpen((o) => !o)} className="text-xs text-slate-500 hover:text-slate-700">
          Report
        </button>
      </div>

      {reportOpen && <ReportForm reviewId={review.id} onClose={() => setReportOpen(false)} />}
    </article>
  );
}

function ReportForm({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const [reason, setReason] = useState("Inappropriate or harassing");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setSubmitting(true);
    const res = await fetch(`/api/reviews/${reviewId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details }),
    });
    setSubmitting(false);
    if (res.ok) setDone(true);
  }

  if (done) {
    return (
      <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        Thanks — our moderation team will review this.
        <button className="ml-2 text-xs underline" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="label">Reason</label>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option>Inappropriate or harassing</option>
        <option>Threats or false claims</option>
        <option>Personal attack</option>
        <option>Spam or fake review</option>
        <option>Other</option>
      </select>
      <label className="label">Details (optional)</label>
      <textarea className="input min-h-[72px]" value={details} onChange={(e) => setDetails(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button className="btn-ghost text-xs" onClick={onClose}>Cancel</button>
        <button className="btn-primary text-xs" disabled={submitting} onClick={submit}>
          {submitting ? "Sending…" : "Submit report"}
        </button>
      </div>
    </div>
  );
}
