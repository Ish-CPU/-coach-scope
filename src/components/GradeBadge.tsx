import { cn } from "@/lib/cn";
import { convertRatingToLetterGrade, convertRatingToPercentage } from "@/lib/review-weighting";

const LETTER_TONE: Record<string, string> = {
  "A+": "bg-emerald-600 text-white",
  A: "bg-emerald-500 text-white",
  "A-": "bg-emerald-500 text-white",
  "B+": "bg-lime-500 text-white",
  B: "bg-lime-500 text-white",
  "B-": "bg-lime-500 text-white",
  "C+": "bg-amber-500 text-white",
  C: "bg-amber-500 text-white",
  "C-": "bg-amber-500 text-white",
  "D+": "bg-orange-500 text-white",
  D: "bg-orange-500 text-white",
  "D-": "bg-orange-500 text-white",
  F: "bg-red-600 text-white",
};

interface Props {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  showCount?: boolean;
  className?: string;
}

export function GradeBadge({
  rating,
  reviewCount,
  size = "md",
  showPercentage = true,
  showCount = true,
  className,
}: Props) {
  const letter = convertRatingToLetterGrade(rating);
  const pct = convertRatingToPercentage(rating);
  const tone = LETTER_TONE[letter] ?? "bg-slate-400 text-white";
  const isUnrated = !rating || rating <= 0;

  const dim =
    size === "lg"
      ? "h-16 w-16 text-2xl"
      : size === "sm"
      ? "h-9 w-9 text-sm"
      : "h-12 w-12 text-lg";

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl font-extrabold leading-none shadow-sm",
          dim,
          isUnrated ? "bg-slate-200 text-slate-500" : tone
        )}
        title={isUnrated ? "Not yet rated" : `Letter grade ${letter}`}
      >
        {isUnrated ? "—" : letter}
      </div>
      {(showPercentage || showCount) && (
        <div className="text-xs text-slate-600">
          {showPercentage && (
            <div className="font-semibold text-slate-800">
              {isUnrated ? "Not rated yet" : `${pct}%`}
            </div>
          )}
          {showCount && (
            <div>
              {typeof reviewCount === "number"
                ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`
                : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
