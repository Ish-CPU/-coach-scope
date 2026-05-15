"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewType } from "@prisma/client";
import { RATING_DESCRIPTIONS, RATING_FIELDS, RATING_LABELS } from "@/lib/review-schemas";
import { RatingStars } from "@/components/RatingStars";

interface Option {
  id: string;
  label: string;
  schoolId?: string;
}

interface Props {
  initial: {
    reviewType: ReviewType;
    coachId?: string;
    schoolId?: string;
    universityId?: string;
    dormId?: string;
  };
  options: {
    coaches: Option[];
    universities: Option[];
    dorms: Option[];
  };
  /** Review types the user is allowed to submit (server-resolved). */
  allowed: ReviewType[];
}

export function ReviewForm({ initial, options, allowed }: Props) {
  const router = useRouter();
  const [reviewType, setReviewType] = useState<ReviewType>(initial.reviewType);
  const [coachId, setCoachId] = useState<string | undefined>(initial.coachId);
  const [schoolId, setSchoolId] = useState<string | undefined>(initial.schoolId);
  const [universityId, setUniversityId] = useState<string | undefined>(initial.universityId);
  const [dormId, setDormId] = useState<string | undefined>(initial.dormId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => RATING_FIELDS[reviewType] as readonly string[], [reviewType]);

  function setRating(k: string, v: number) {
    setRatings((r) => ({ ...r, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId && coachId) {
      const c = options.coaches.find((c) => c.id === coachId);
      if (c?.schoolId) resolvedSchoolId = c.schoolId;
    }

    setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewType,
        title: title || undefined,
        body,
        coachId: reviewType === "COACH" || reviewType === "PARENT_INSIGHT" ? coachId : undefined,
        schoolId:
          reviewType === "PROGRAM" ? resolvedSchoolId : reviewType === "PARENT_INSIGHT" ? resolvedSchoolId : undefined,
        universityId: reviewType === "UNIVERSITY" ? universityId : undefined,
        dormId: reviewType === "DORM" ? dormId : undefined,
        ratings,
        isAnonymous,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not submit. Make sure every rating is set 1–5.");
      return;
    }

    if (reviewType === "COACH" && coachId) router.push(`/coach/${coachId}`);
    else if (reviewType === "UNIVERSITY" && universityId) router.push(`/university/${universityId}`);
    else if (reviewType === "DORM" && dormId) router.push(`/dorm/${dormId}`);
    else router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {allowed.length > 1 && (
        <div>
          <label className="label">Review type</label>
          <div className="flex flex-wrap gap-2">
            {allowed.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  setReviewType(t);
                  setRatings({});
                }}
                className={`rounded-full px-3 py-1 text-sm ${
                  reviewType === t ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t.toLowerCase().replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {(reviewType === "COACH" || reviewType === "PARENT_INSIGHT") && (
        <div>
          <label className="label">Coach</label>
          <select className="input" value={coachId ?? ""} onChange={(e) => setCoachId(e.target.value || undefined)}>
            <option value="">— Choose a coach —</option>
            {options.coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {reviewType === "PROGRAM" && (
        <div>
          <label className="label">Program (school)</label>
          <select className="input" value={schoolId ?? ""} onChange={(e) => setSchoolId(e.target.value || undefined)}>
            <option value="">— Choose a program —</option>
            {options.coaches.map((c) => (
              <option key={c.schoolId} value={c.schoolId}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {reviewType === "UNIVERSITY" && (
        <div>
          <label className="label">University</label>
          <select
            className="input"
            value={universityId ?? ""}
            onChange={(e) => setUniversityId(e.target.value || undefined)}
          >
            <option value="">— Choose a university —</option>
            {options.universities.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>
      )}

      {reviewType === "DORM" && (
        <div>
          <label className="label">Dorm</label>
          <select className="input" value={dormId ?? ""} onChange={(e) => setDormId(e.target.value || undefined)}>
            <option value="">— Choose a dorm —</option>
            {options.dorms.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Parents submit qualitative insights only — keep the rating block minimal */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {reviewType === "PARENT_INSIGHT" ? "Insight ratings" : "Ratings"}
        </h3>
        {reviewType === "PARENT_INSIGHT" && (
          <p className="mt-1 text-xs text-slate-500">
            Parents share structured insights — focus on what you observed during the recruiting and family experience.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-700">{RATING_LABELS[f] ?? f}</div>
                {RATING_DESCRIPTIONS[f] && (
                  <div className="text-[11px] leading-tight text-slate-500">{RATING_DESCRIPTIONS[f]}</div>
                )}
              </div>
              <RatingStars value={ratings[f] ?? 0} onChange={(v) => setRating(f, v)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Title (optional)</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
      </div>

      <div>
        <label className="label">Your review</label>
        <textarea
          className="input min-h-[160px]"
          required
          minLength={20}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What was your experience? Be specific and fair."
        />
        <div className="mt-1 text-xs text-slate-500">
          {isAnonymous
            ? "You'll appear publicly under an anonymous handle (e.g. “Anonymous Verified Athlete”). Your identity stays private but is tracked internally to prevent abuse."
            : "You'll appear publicly under your account display name. You can change this back to anonymous below."}
        </div>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="font-medium">Post anonymously</span>
            <span className="block text-xs text-slate-500">
              Default. Uncheck to publish under your account display name.
            </span>
          </span>
        </label>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <button className="btn-primary w-full sm:w-auto" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
