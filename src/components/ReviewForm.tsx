"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewType } from "@prisma/client";
import {
  RATING_DESCRIPTIONS,
  RATING_FIELDS,
  RATING_LABELS,
  categoryAllowsNA,
} from "@/lib/review-schemas";
import { RatingStars } from "@/components/RatingStars";
import {
  UniversityCombobox,
  type UniversityOption,
} from "@/components/shared/UniversityCombobox";
import {
  ProgramCombobox,
  type ProgramOption,
} from "@/components/shared/ProgramCombobox";
import {
  CoachCombobox,
  type CoachOption,
} from "@/components/shared/CoachCombobox";
import { DormCombobox } from "@/components/shared/DormCombobox";

interface Props {
  initial: {
    reviewType: ReviewType;
    coachId?: string;
    schoolId?: string;
    universityId?: string;
    dormId?: string;
  };
  /** Review types the user is allowed to submit (server-resolved). */
  allowed: ReviewType[];
}

/**
 * Write-a-Review form.
 *
 * The picker is a chain of live comboboxes that query the real Prisma
 * tables — there's no server-side pre-scoping anymore. The user can
 * search for any university / program / coach / dorm. Permission gating
 * happens at submit time via `/api/reviews` → `describeReviewBlock`,
 * which returns a clear rejection message the form surfaces verbatim.
 *
 * Rationale for "no scoping at the picker": pre-scoping by approved
 * connections produced confusing UX (e.g. recruit dropdown showing
 * only Penn State + Colorado because those happened to be their
 * approved RECRUITED_BY rows; or showing 200 random programs from a
 * fallback when the user wasn't in `isAthleteTrustedRole`). The new
 * model — search anything, get a useful rejection message at submit
 * — matches how the verification + connection forms already work.
 *
 * Picker chains by review type:
 *   COACH         → University → Program → Coach
 *   PROGRAM       → University → Program
 *   RECRUITING    → University → Program
 *   PARENT_INSIGHT → University → Program → Coach (parents review coaches)
 *   UNIVERSITY    → University
 *   ADMISSIONS    → University
 *   DORM          → University → Dorm
 */
export function ReviewForm({ initial, allowed }: Props) {
  const router = useRouter();
  const [reviewType, setReviewType] = useState<ReviewType>(initial.reviewType);

  // Picker state. `pickerUniversityId` drives the combobox-chain
  // regardless of review type. `schoolId` / `coachId` / `dormId` /
  // `universityId` are the values the API ultimately receives.
  const [pickerUniversityId, setPickerUniversityId] = useState<string>(
    initial.universityId ?? ""
  );
  const [pickerUniversityName, setPickerUniversityName] = useState<string>("");
  const [universityId, setUniversityId] = useState<string | undefined>(
    initial.universityId
  );
  const [schoolId, setSchoolId] = useState<string>(initial.schoolId ?? "");
  const [coachId, setCoachId] = useState<string>(initial.coachId ?? "");
  const [dormId, setDormId] = useState<string>(initial.dormId ?? "");

  // For UNIVERSITY / ADMISSIONS reviews, the same pickerUniversityId IS
  // the target — keep them in sync.
  useEffect(() => {
    if (
      reviewType === ReviewType.UNIVERSITY ||
      reviewType === ReviewType.ADMISSIONS
    ) {
      setUniversityId(pickerUniversityId || undefined);
    }
  }, [reviewType, pickerUniversityId]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ratings, setRatings] = useState<Record<string, number | null>>({});
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(
    () => RATING_FIELDS[reviewType] as readonly string[],
    [reviewType]
  );

  function setRating(k: string, v: number | null) {
    setRatings((r) => ({ ...r, [k]: v }));
  }

  // Debug log on every render — surfaces the full picker state in DevTools
  // so it's obvious what the user has selected before they submit.
  // eslint-disable-next-line no-console
  console.debug("[ReviewForm] state", {
    selectedReviewType: reviewType,
    pickerUniversityId,
    pickerUniversityName,
    selectedUniversityId: universityId,
    selectedSchoolId: schoolId,
    selectedCoachId: coachId,
    selectedDormId: dormId,
  });

  function resetPickers() {
    setPickerUniversityId("");
    setPickerUniversityName("");
    setUniversityId(undefined);
    setSchoolId("");
    setCoachId("");
    setDormId("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Require an explicit decision (star value OR N/A) on every category.
    const missing: string[] = [];
    const naForRequired: string[] = [];
    for (const f of fields) {
      const v = ratings[f];
      if (v === undefined) missing.push(RATING_LABELS[f] ?? f);
      if (v === null && !categoryAllowsNA(reviewType, f))
        naForRequired.push(RATING_LABELS[f] ?? f);
    }
    if (missing.length > 0) {
      setError(`Please rate or mark N/A: ${missing.join(", ")}.`);
      return;
    }
    if (naForRequired.length > 0) {
      setError(
        `${naForRequired.join(", ")} cannot be marked N/A — please give 1–5 stars.`
      );
      return;
    }

    // Build the payload per review-type contract. RECRUITING gets BOTH
    // schoolId and universityId so the row stays joinable both ways.
    const payload = {
      reviewType,
      title: title || undefined,
      body,
      coachId:
        reviewType === ReviewType.COACH || reviewType === ReviewType.PARENT_INSIGHT
          ? coachId || undefined
          : undefined,
      schoolId:
        reviewType === ReviewType.PROGRAM ||
        reviewType === ReviewType.PARENT_INSIGHT ||
        reviewType === ReviewType.RECRUITING
          ? schoolId || undefined
          : undefined,
      universityId:
        reviewType === ReviewType.UNIVERSITY ||
        reviewType === ReviewType.ADMISSIONS
          ? universityId || undefined
          : reviewType === ReviewType.RECRUITING
          ? // Spec: RECRUITING includes universityId alongside schoolId.
            pickerUniversityId || undefined
          : reviewType === ReviewType.DORM
          ? // Useful for analytics — dorm review tied back to its uni.
            pickerUniversityId || undefined
          : undefined,
      dormId: reviewType === ReviewType.DORM ? dormId || undefined : undefined,
      ratings,
      isAnonymous,
    };
    // eslint-disable-next-line no-console
    console.debug("[ReviewForm] submitPayload", payload);

    setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    const j = await res.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.debug("[ReviewForm] submit permission result", {
      ok: res.ok,
      status: res.status,
      error: j.error ?? null,
      reviewId: j.id ?? null,
    });
    if (!res.ok) {
      setError(
        typeof j.error === "string"
          ? j.error
          : "Could not submit. Make sure every rating is set 1–5."
      );
      return;
    }

    if (reviewType === ReviewType.COACH && coachId) router.push(`/coach/${coachId}`);
    else if (reviewType === ReviewType.UNIVERSITY && universityId)
      router.push(`/university/${universityId}`);
    else if (reviewType === ReviewType.DORM && dormId)
      router.push(`/dorm/${dormId}`);
    else router.push("/dashboard");
    router.refresh();
  }

  // Helper: when the university picker changes, propagate the right state
  // for the current review type. UNIVERSITY/ADMISSIONS reviews use the
  // picked uni directly as the target; everything else just uses it to
  // scope the next combobox.
  function handleUniversityPick(id: string, u: UniversityOption | null) {
    setPickerUniversityId(id);
    setPickerUniversityName(u?.name ?? "");
    // Reset downstream selections — a school / coach / dorm picked under
    // the previous university is no longer valid.
    setSchoolId("");
    setCoachId("");
    setDormId("");
    if (
      reviewType === ReviewType.UNIVERSITY ||
      reviewType === ReviewType.ADMISSIONS
    ) {
      setUniversityId(id || undefined);
    } else {
      setUniversityId(undefined);
    }
  }

  function handleProgramPick(id: string, _p: ProgramOption | null) {
    setSchoolId(id);
    setCoachId(""); // re-pick a coach under the new program
  }

  function handleCoachPick(id: string, _c: CoachOption | null) {
    setCoachId(id);
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
                  // eslint-disable-next-line no-console
                  console.debug("[ReviewForm] review type changed", {
                    from: reviewType,
                    to: t,
                  });
                  setReviewType(t);
                  setRatings({});
                  resetPickers();
                }}
                className={`rounded-full px-3 py-1 text-sm ${
                  reviewType === t
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {t.toLowerCase().replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* University picker — present for every review type except plain
          PARENT_INSIGHT (which still needs uni → program → coach). */}
      <UniversityCombobox
        label={
          reviewType === ReviewType.RECRUITING
            ? "University (recruiting target)"
            : reviewType === ReviewType.ADMISSIONS
            ? "University (admissions / visit target)"
            : "University"
        }
        value={pickerUniversityId}
        onChange={handleUniversityPick}
        required
      />

      {/* Program picker — for COACH / PROGRAM / RECRUITING / PARENT_INSIGHT. */}
      {(reviewType === ReviewType.COACH ||
        reviewType === ReviewType.PROGRAM ||
        reviewType === ReviewType.RECRUITING ||
        reviewType === ReviewType.PARENT_INSIGHT) && (
        <ProgramCombobox
          label={
            reviewType === ReviewType.RECRUITING
              ? "Program (recruiting target)"
              : "Program / sport"
          }
          universityId={pickerUniversityId}
          value={schoolId}
          onChange={handleProgramPick}
          required
        />
      )}

      {/* Coach picker — for COACH / PARENT_INSIGHT. */}
      {(reviewType === ReviewType.COACH ||
        reviewType === ReviewType.PARENT_INSIGHT) && (
        <CoachCombobox
          label="Coach"
          schoolId={schoolId}
          value={coachId}
          onChange={handleCoachPick}
          required
        />
      )}

      {/* Dorm picker — for DORM only. */}
      {reviewType === ReviewType.DORM && (
        <DormCombobox
          universityId={pickerUniversityId}
          value={dormId}
          onChange={(id) => setDormId(id)}
          required
        />
      )}

      {/* Recruiting copy reminder. */}
      {reviewType === ReviewType.RECRUITING && (
        <p className="text-xs text-slate-500">
          Recruiting reviews rate the <em>recruiting process</em> — the program's
          communication, honesty, follow-through. You can mention a specific
          recruiter in the body, but please don't make personal attacks.
        </p>
      )}
      {reviewType === ReviewType.ADMISSIONS && (
        <p className="text-xs text-slate-500">
          Admissions reviews rate the <em>admissions process / campus visit experience</em>
          — not professors or programs. Be specific and fair.
        </p>
      )}

      {/* Ratings block (unchanged). */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {reviewType === ReviewType.PARENT_INSIGHT ? "Insight ratings" : "Ratings"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Choose <strong>N/A</strong> if a category does not apply to your school or
          program (e.g. JUCOs without athletic scholarships, schools without NIL,
          dorms without a meal plan). N/A entries are excluded from averages — they
          will not be counted as a low score.
        </p>
        {reviewType === ReviewType.PARENT_INSIGHT && (
          <p className="mt-1 text-xs text-slate-500">
            Focus on what you observed during the recruiting and family experience.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.map((f) => {
            const allowNA = categoryAllowsNA(reviewType, f);
            const raw = ratings[f];
            const value: number | null = raw === undefined ? 0 : raw;
            return (
              <div key={f} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-700">{RATING_LABELS[f] ?? f}</div>
                  {RATING_DESCRIPTIONS[f] && (
                    <div className="text-[11px] leading-tight text-slate-500">
                      {RATING_DESCRIPTIONS[f]}
                    </div>
                  )}
                  {!allowNA && (
                    <div className="mt-0.5 text-[11px] font-medium text-slate-400">
                      Required
                    </div>
                  )}
                </div>
                <RatingStars value={value} onChange={(v) => setRating(f, v)} allowNA={allowNA} />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">Title (optional)</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
        />
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button className="btn-primary w-full sm:w-auto" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
