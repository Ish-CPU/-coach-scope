import { RatingStars } from "@/components/RatingStars";
import { GradeBadge } from "@/components/GradeBadge";
import { RATING_DESCRIPTIONS, RATING_LABELS } from "@/lib/review-schemas";
import { convertRatingToLetterGrade, convertRatingToPercentage } from "@/lib/review-weighting";

export function RatingSummary({
  overall,
  reviewCount,
  categories,
}: {
  overall: number;
  reviewCount: number;
  categories: Record<string, number>;
}) {
  return (
    <div className="card p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <GradeBadge
            rating={overall}
            reviewCount={reviewCount}
            size="lg"
            showCount={false}
            showPercentage={false}
          />
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-slate-900">
                {overall > 0 ? overall.toFixed(1) : "—"}
              </span>
              <span className="text-sm font-medium text-slate-500">/ 5</span>
            </div>
            <RatingStars value={overall} />
            <div className="mt-1 text-xs text-slate-500">
              {overall > 0
                ? `${convertRatingToPercentage(overall)}% · grade ${convertRatingToLetterGrade(overall)}`
                : "Awaiting reviews"}
            </div>
            <div className="text-xs text-slate-500">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"} (weighted)
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {Object.entries(categories).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span
                className="text-slate-600"
                title={RATING_DESCRIPTIONS[k] ?? undefined}
              >
                {RATING_LABELS[k] ?? k}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200 sm:w-24">
                  <div
                    className="h-full bg-brand-500"
                    style={{ width: `${v > 0 ? (v / 5) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium text-slate-700">
                  {v > 0 ? v.toFixed(1) : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
