"use client";

import { cn } from "@/lib/cn";

/**
 * Star rating with optional "N/A" toggle.
 *
 * Three states a controlled value can take:
 *   - 1..5    → that many stars filled, N/A pill inactive
 *   - null    → all stars empty, N/A pill active (= "Not applicable")
 *   - 0       → all stars empty, N/A pill inactive (unset / read-only display)
 *
 * Mutual exclusion is enforced here, not in the parent: clicking a star
 * clears the N/A flag, and clicking N/A clears any selected stars. The
 * parent only needs to forward the new value through `onChange`.
 *
 * Set `allowNA` to true on categories that legitimately don't apply to
 * every school/program (NIL, scholarships, nutrition, etc.). Headline
 * "overall" categories should leave it false — every review must produce
 * a meaningful overall score.
 */
export function RatingStars({
  value,
  size = "md",
  onChange,
  max = 5,
  allowNA = false,
}: {
  value: number | null;
  size?: "sm" | "md" | "lg";
  onChange?: (v: number | null) => void;
  max?: number;
  allowNA?: boolean;
}) {
  const interactive = Boolean(onChange);
  const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const isNA = value === null;
  // For star fills we treat null as "no stars"; never coerce to NaN.
  const numericValue = typeof value === "number" ? value : 0;

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => {
          const filled = !isNA && i + 1 <= Math.round(numericValue);
          return (
            <button
              type="button"
              key={i}
              disabled={!interactive}
              onClick={() => onChange?.(i + 1)}
              className={cn(
                "transition",
                interactive ? "cursor-pointer" : "cursor-default",
                filled ? "text-amber-500" : "text-slate-300",
                interactive && "hover:scale-110"
              )}
              aria-label={`${i + 1} of ${max} stars`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={dim}>
                <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6z" />
              </svg>
            </button>
          );
        })}
      </div>
      {allowNA && (
        <button
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(isNA ? 0 : null)}
          aria-pressed={isNA}
          aria-label={isNA ? "N/A selected — click to clear" : "Mark this category as N/A"}
          title="Choose N/A if this category does not apply to your school/program."
          className={cn(
            // Base pill — generous padding so the selected state has room
            // to register visually next to the small star row.
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition",
            // Focus ring stays visible whether selected or not so keyboard
            // users get the same affordance as mouse users.
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
            isNA
              ? // Selected: brand-coloured fill + matching border + white
                // text + soft ring so the contrast against the surrounding
                // card is obvious without being shouty.
                "border-brand-700 bg-brand-700 text-white shadow-sm ring-2 ring-brand-200"
              : // Unselected: neutral chip that hovers darker.
                "border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200",
            !interactive && "cursor-default"
          )}
        >
          {isNA && (
            // Inline checkmark glyph reinforces the selected state for
            // colour-blind users + tiny screens.
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-3 w-3"
            >
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 00-1.4-1.4L8 11.1 4.7 7.8a1 1 0 10-1.4 1.4l4 4a1 1 0 001.4 0l8-8z"
                clipRule="evenodd"
              />
            </svg>
          )}
          N/A
        </button>
      )}
    </div>
  );
}
