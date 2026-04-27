import { runSearch, type SearchKind } from "@/lib/search";
import { SearchBar } from "@/components/SearchBar";
import { ResultCard } from "@/components/ResultCard";
import { AdSlot } from "@/components/AdSlot";
import { Division, ReviewType } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function get(sp: PageProps["searchParams"], k: string): string | undefined {
  const v = sp[k];
  return Array.isArray(v) ? v[0] : v;
}

const SPORTS = ["Baseball", "Football", "Basketball", "Soccer", "Volleyball", "Hockey", "Lacrosse", "Swimming"];
const DIVISIONS: Division[] = ["D1", "D2", "D3", "NAIA", "NJCAA", "OTHER"];
const KINDS: SearchKind[] = ["all", "coach", "university", "dorm", "school"];

export default async function SearchPage({ searchParams }: PageProps) {
  const filters = {
    q: get(searchParams, "q"),
    kind: (get(searchParams, "kind") as SearchKind) ?? "all",
    sport: get(searchParams, "sport"),
    division: get(searchParams, "division") as Division | undefined,
    minRating: get(searchParams, "minRating") ? Number(get(searchParams, "minRating")) : undefined,
    reviewType: get(searchParams, "reviewType") as ReviewType | undefined,
    verifiedAthleteOnly: get(searchParams, "verifiedAthleteOnly") === "1",
    parentReviewsOnly: get(searchParams, "parentReviewsOnly") === "1",
    verifiedStudentOnly: get(searchParams, "verifiedStudentOnly") === "1",
  };

  const hits = await runSearch(filters);

  return (
    <div className="container-page py-8">
      <SearchBar className="mb-6" />

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <FilterCard title="Type">
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <FilterPill key={k} active={filters.kind === k} href={withParam(searchParams, "kind", k === "all" ? undefined : k)}>
                  {k}
                </FilterPill>
              ))}
            </div>
          </FilterCard>

          <FilterCard title="Sport">
            <div className="flex flex-wrap gap-2">
              <FilterPill active={!filters.sport} href={withParam(searchParams, "sport", undefined)}>any</FilterPill>
              {SPORTS.map((s) => (
                <FilterPill key={s} active={filters.sport === s} href={withParam(searchParams, "sport", s)}>
                  {s}
                </FilterPill>
              ))}
            </div>
          </FilterCard>

          <FilterCard title="Division">
            <div className="flex flex-wrap gap-2">
              <FilterPill active={!filters.division} href={withParam(searchParams, "division", undefined)}>any</FilterPill>
              {DIVISIONS.map((d) => (
                <FilterPill key={d} active={filters.division === d} href={withParam(searchParams, "division", d)}>
                  {d}
                </FilterPill>
              ))}
            </div>
          </FilterCard>

          <FilterCard title="Min rating">
            <div className="flex gap-2">
              {[0, 3, 4, 4.5].map((r) => (
                <FilterPill key={r} active={(filters.minRating ?? 0) === r} href={withParam(searchParams, "minRating", r ? String(r) : undefined)}>
                  {r ? `${r}+` : "any"}
                </FilterPill>
              ))}
            </div>
          </FilterCard>

          <FilterCard title="Reviewer">
            <div className="flex flex-col gap-2 text-sm">
              <ToggleLink
                active={filters.verifiedAthleteOnly}
                href={withParam(searchParams, "verifiedAthleteOnly", filters.verifiedAthleteOnly ? undefined : "1")}
                label="Verified athletes only"
              />
              <ToggleLink
                active={filters.parentReviewsOnly}
                href={withParam(searchParams, "parentReviewsOnly", filters.parentReviewsOnly ? undefined : "1")}
                label="Parent reviews only"
              />
              <ToggleLink
                active={filters.verifiedStudentOnly}
                href={withParam(searchParams, "verifiedStudentOnly", filters.verifiedStudentOnly ? undefined : "1")}
                label="Verified students only"
              />
            </div>
          </FilterCard>

          <FilterCard title="Review type">
            <div className="flex flex-wrap gap-2">
              <FilterPill active={!filters.reviewType} href={withParam(searchParams, "reviewType", undefined)}>any</FilterPill>
              {(Object.values(ReviewType) as ReviewType[]).map((rt) => (
                <FilterPill key={rt} active={filters.reviewType === rt} href={withParam(searchParams, "reviewType", rt)}>
                  {rt.toLowerCase().replace("_", " ")}
                </FilterPill>
              ))}
            </div>
          </FilterCard>
        </aside>

        <div>
          <div className="mb-3 text-sm text-slate-500">{hits.length} results</div>
          <AdSlot variant="banner" className="mb-4" />
          <div className="grid gap-3">
            {hits.length === 0 ? (
              <div className="card p-10 text-center text-slate-500">
                No results. Try adjusting your filters.
              </div>
            ) : (
              hits.map((h) => <ResultCard key={`${h.type}:${h.id}`} hit={h} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
      {children}
    </div>
  );
}

function FilterPill({
  active,
  href,
  children,
}: {
  active?: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}

function ToggleLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-slate-700">
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white"}`}>
        {active && (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 00-1.4-1.4L8 11.1 4.7 7.8a1 1 0 10-1.4 1.4l4 4a1 1 0 001.4 0l8-8z" clipRule="evenodd" />
          </svg>
        )}
      </span>
      {label}
    </Link>
  );
}

function withParam(sp: PageProps["searchParams"], key: string, value: string | undefined) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === key) continue;
    if (typeof v === "string") usp.set(k, v);
    if (Array.isArray(v) && v[0]) usp.set(k, v[0]);
  }
  if (value) usp.set(key, value);
  return `/search?${usp.toString()}`;
}
