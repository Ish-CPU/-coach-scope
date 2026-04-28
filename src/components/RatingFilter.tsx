import Link from "next/link";
import { RATING_FILTER_OPTIONS } from "@/lib/rating-filter";
import { cn } from "@/lib/cn";

/**
 * Reusable rating-filter pill row.
 *
 * `buildHref(value)` should return a URL with `minRating` set to the chosen
 * `RatingFilterOption.param` (or removed when "Any Rating" is selected),
 * preserving any other query params on the page.
 */
export function RatingFilter({
  current,
  buildHref,
  label = "Min rating",
  className,
}: {
  current: number | null;
  buildHref: (value: number | null) => string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </h4>
      <div className="flex flex-wrap gap-2">
        {RATING_FILTER_OPTIONS.map((opt) => {
          const active = (current ?? null) === opt.value;
          return (
            <Link
              key={opt.label}
              href={buildHref(opt.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                active
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
