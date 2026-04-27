"use client";

import { cn } from "@/lib/cn";

export function RatingStars({
  value,
  size = "md",
  onChange,
  max = 5,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  onChange?: (v: number) => void;
  max?: number;
}) {
  const interactive = Boolean(onChange);
  const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i + 1 <= Math.round(value);
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
  );
}
