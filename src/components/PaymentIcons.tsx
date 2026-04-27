import { cn } from "@/lib/cn";

/** Inline SVG-ish payment-method badges, no external assets. */
const ITEMS: { label: string; tone: string; sub?: string }[] = [
  { label: "Visa", tone: "bg-[#1a1f71] text-white" },
  { label: "Mastercard", tone: "bg-white text-slate-900 ring-1 ring-slate-200" },
  { label: "Apple Pay", tone: "bg-black text-white" },
  { label: "Google Pay", tone: "bg-white text-slate-900 ring-1 ring-slate-200" },
  { label: "PayPal", tone: "bg-[#0070ba] text-white", sub: "coming soon" },
];

export function PaymentIcons({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {ITEMS.map((i) => (
        <span
          key={i.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
            i.tone,
            i.sub && "opacity-60"
          )}
        >
          {i.label}
          {i.sub && <span className="font-normal italic">· {i.sub}</span>}
        </span>
      ))}
    </div>
  );
}
