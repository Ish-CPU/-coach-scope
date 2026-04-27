import { cn } from "@/lib/cn";

type Variant = "banner" | "between" | "sidebar";

const STYLES: Record<Variant, string> = {
  banner: "h-24 w-full",
  between: "h-32 w-full",
  sidebar: "h-72 w-full",
};

/**
 * Placeholder ad slot. Wire real Google AdSense markup here later.
 * Set NEXT_PUBLIC_ADSENSE_CLIENT_ID and replace the inner div with
 * <ins className="adsbygoogle" ... /> + the script tag in <head>.
 */
export function AdSlot({
  variant,
  className,
  label = "Ad",
}: {
  variant: Variant;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs uppercase tracking-wider text-slate-400",
        STYLES[variant],
        className
      )}
      data-ad-slot={variant}
      aria-label="advertisement"
    >
      {label} · {variant}
    </div>
  );
}
