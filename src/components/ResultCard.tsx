import Link from "next/link";
import { GradeBadge } from "@/components/GradeBadge";
import { divisionLabel } from "@/lib/division";
import type { SearchHit } from "@/lib/search";

const ICONS: Record<SearchHit["type"], string> = {
  coach: "🧑‍🏫",
  university: "🎓",
  dorm: "🏠",
  school: "🏟️",
};

const CTA_LABEL: Record<SearchHit["type"], string> = {
  coach: "View Coach",
  university: "View University",
  dorm: "View Dorm",
  school: "View Program",
};

export function ResultCard({ hit }: { hit: SearchHit }) {
  if (hit.type === "coach") return <CoachResultCard hit={hit} />;
  return <DefaultResultCard hit={hit} />;
}

/**
 * Standard layout used for university / dorm / program / school hits.
 * Single line of context + grade badge on the right.
 */
function DefaultResultCard({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={hit.href}
      className="card flex items-center gap-4 p-4 transition hover:shadow-card"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
        {ICONS[hit.type]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-400">{hit.type}</span>
        </div>
        <h3 className="truncate text-base font-semibold text-slate-900">{hit.title}</h3>
        {hit.subtitle && <div className="truncate text-sm text-slate-600">{hit.subtitle}</div>}
        {(hit.meta?.conference || hit.meta?.state) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {hit.meta?.conference && <Chip>{hit.meta.conference}</Chip>}
            {hit.meta?.state && <Chip>{hit.meta.state}</Chip>}
          </div>
        )}
      </div>
      <div className="hidden shrink-0 sm:block">
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

/**
 * Richer layout for coach hits — surfaces title, sport, division,
 * conference, and the school the coach is at, plus an explicit CTA.
 *
 * Whole card is a link so the entire surface is tappable on mobile;
 * the inner CTA is purely visual.
 */
function CoachResultCard({ hit }: { hit: SearchHit }) {
  const meta = hit.meta ?? {};
  const division = meta.division ? divisionLabel(meta.division) : null;
  const chips = [meta.sport, division, meta.conference].filter(Boolean) as string[];

  return (
    <Link
      href={hit.href}
      className="card group flex flex-col gap-4 p-4 transition hover:shadow-card sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-4 sm:flex-1 sm:min-w-0">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
          {ICONS.coach}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400">Coach</span>
          </div>
          <h3 className="truncate text-base font-semibold text-slate-900">{hit.title}</h3>
          <div className="mt-0.5 truncate text-sm text-slate-600">
            {meta.coachTitle ?? "Coach"}
            {meta.schoolName ? <> · {meta.schoolName}</> : null}
            {meta.state ? <span className="text-slate-400"> · {meta.state}</span> : null}
          </div>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <GradeBadge
          rating={hit.rating ?? 0}
          reviewCount={hit.reviewCount ?? 0}
          size="md"
          showPercentage
          showCount
        />
        <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
          {CTA_LABEL.coach} →
        </span>
      </div>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      {children}
    </span>
  );
}
