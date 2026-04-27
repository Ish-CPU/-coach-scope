import Link from "next/link";
import { GradeBadge } from "@/components/GradeBadge";
import type { SearchHit } from "@/lib/search";

const ICONS: Record<SearchHit["type"], string> = {
  coach: "🧑‍🏫",
  university: "🎓",
  dorm: "🏠",
  school: "🏟️",
};

export function ResultCard({ hit }: { hit: SearchHit }) {
  return (
    <Link href={hit.href} className="card flex items-center gap-4 p-4 hover:shadow-card transition">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
        {ICONS[hit.type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400">{hit.type}</span>
        </div>
        <h3 className="truncate text-base font-semibold text-slate-900">{hit.title}</h3>
        {hit.subtitle && <div className="truncate text-sm text-slate-600">{hit.subtitle}</div>}
      </div>
      <div className="shrink-0">
        <GradeBadge
          rating={hit.rating ?? 0}
          reviewCount={hit.reviewCount ?? 0}
          size="md"
          showPercentage
          showCount
        />
      </div>
    </Link>
  );
}
