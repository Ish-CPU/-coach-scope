"use client";

import type { Signal } from "@/lib/verification-confidence";

/**
 * Renders the auto-confidence signals as a checklist next to a verification
 * request. Pure presentation — the same `signals` array is computed in
 * `src/lib/verification-confidence.ts` so the row component stays cheap.
 *
 * `score` and `bucket` come from the persisted request fields so a refresh
 * shows the same numbers the queue was sorted by.
 */
export function VerificationScorecard({
  score,
  bucket,
  signals,
}: {
  score: number | null;
  bucket: string;
  signals: Signal[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Auto-confidence scorecard
        </h4>
        <div className="flex items-center gap-2">
          <BucketBadge bucket={bucket} />
          {typeof score === "number" && (
            <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
              {score} / 100
            </span>
          )}
        </div>
      </div>

      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {signals.map((s) => (
          <li
            key={s.key}
            className="flex items-start gap-2 rounded-md bg-white px-2 py-1.5 text-[11px] ring-1 ring-slate-200"
          >
            <Glyph ok={s.ok} />
            <div className="min-w-0">
              <div className="font-medium text-slate-800">{s.label}</div>
              {s.detail && <div className="text-slate-500">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Glyph({ ok }: { ok: boolean | null }) {
  if (ok === true) {
    return (
      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (ok === false) {
    return (
      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
        ✕
      </span>
    );
  }
  // Tri-state "not enough info to tell" — neutral grey dot.
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-white">
      –
    </span>
  );
}

const BUCKET_TONE: Record<string, string> = {
  HIGH_CONFIDENCE: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800 ring-amber-600/20",
  NEEDS_MORE_INFO: "bg-amber-100 text-amber-800 ring-amber-600/20",
  LOW_CONFIDENCE: "bg-red-100 text-red-800 ring-red-600/20",
  PENDING: "bg-slate-100 text-slate-700 ring-slate-300",
  APPROVED: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  REJECTED: "bg-red-100 text-red-800 ring-red-600/20",
};

function BucketBadge({ bucket }: { bucket: string }) {
  const tone = BUCKET_TONE[bucket] ?? "bg-slate-100 text-slate-700 ring-slate-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${tone}`}>
      {bucket.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
