import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { canParticipate, getSession } from "@/lib/permissions";
import { defaultReviewSort, weightedCategoryAverage, weightedOverall } from "@/lib/review-weighting";
import { RATING_FIELDS } from "@/lib/review-schemas";
import { ReviewCard } from "@/components/ReviewCard";
import { RatingSummary } from "@/components/RatingSummary";
import { GradeBadge } from "@/components/GradeBadge";
import { RatingFilter } from "@/components/RatingFilter";
import { filterByMinRating, parseMinRating } from "@/lib/rating-filter";
import { buildHrefBuilder } from "@/lib/url";
import { AdSlot } from "@/components/AdSlot";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ReviewType } from "@prisma/client";
import { ANONYMITY_DISCLAIMER } from "@/lib/anonymous";
import { divisionLabel } from "@/lib/division";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function UniversityProfilePage({ params, searchParams }: PageProps) {
  const uni = await safe(
    () =>
      prisma.university.findUnique({
        where: { id: params.id },
        include: {
          schools: {
            orderBy: { sport: "asc" },
            include: {
              coaches: {
                orderBy: { name: "asc" },
                include: {
                  reviews: {
                    where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
                    select: { overall: true, weight: true },
                  },
                },
              },
            },
          },
          dorms: { orderBy: { name: "asc" } },
          diningHalls: { orderBy: { name: "asc" } },
          facilities: { orderBy: { name: "asc" } },
          reviews: {
            where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
            include: { author: { select: { id: true, name: true, role: true, verificationStatus: true } } },
          },
        },
      }),
    null,
    "university:findUnique"
  );
  if (!uni) notFound();

  // Optional sport filter from `?sport=Football`. Trimmed + case-insensitive.
  const rawSport = Array.isArray(searchParams.sport) ? searchParams.sport[0] : searchParams.sport;
  const activeSport = rawSport?.trim() || null;
  const visiblePrograms = activeSport
    ? uni.schools.filter((s) => s.sport.toLowerCase() === activeSport.toLowerCase())
    : uni.schools;
  const sportTabs = Array.from(new Set(uni.schools.map((s) => s.sport))).sort();

  const session = await getSession();
  const canInteract = canParticipate(session);

  // Aggregate stays computed across ALL reviews; the filter only affects
  // the visible list below.
  const overall = weightedOverall(uni.reviews);

  const categories: Record<string, number> = {};
  for (const f of RATING_FIELDS.UNIVERSITY) {
    if (f === "overallExperience") continue;
    categories[f] = weightedCategoryAverage(uni.reviews, f);
  }

  const minRating = parseMinRating(searchParams.minRating);
  const visible = filterByMinRating(uni.reviews, minRating);
  const sorted = defaultReviewSort(visible);
  const buildHref = buildHrefBuilder(`/university/${uni.id}`, searchParams);

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/search?kind=university" className="hover:underline">Universities</Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{uni.name}</span>
      </nav>

      <header className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{uni.name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            {[uni.city, uni.state].filter(Boolean).join(", ")}
          </div>
          {uni.description && <p className="mt-3 max-w-2xl text-sm text-slate-700">{uni.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/review/new?type=UNIVERSITY&universityId=${uni.id}`} className="btn-primary">
              Review this university
            </Link>
          </div>
        </div>
        <GradeBadge rating={overall} reviewCount={uni.reviews.length} size="lg" />
      </header>

      <div className="mt-6">
        <RatingSummary overall={overall} reviewCount={uni.reviews.length} categories={categories} />
      </div>

      {/* --- Athletic programs (sport filter + coach lists) --- */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Athletic programs ({uni.schools.length})
          </h2>
          {activeSport && (
            <Link
              href={`/university/${uni.id}`}
              className="text-xs text-brand-700 hover:underline"
            >
              Clear sport filter
            </Link>
          )}
        </div>

        {uni.schools.length === 0 ? (
          <ProgramsEmpty universityName={uni.name} />
        ) : (
          <>
            {/* Sport filter pills */}
            {sportTabs.length > 1 && (
              <div className="-mx-1 mb-4 flex flex-wrap gap-1.5">
                <SportPill
                  active={!activeSport}
                  href={`/university/${uni.id}`}
                  label={`All sports (${uni.schools.length})`}
                />
                {sportTabs.map((s) => (
                  <SportPill
                    key={s}
                    active={activeSport?.toLowerCase() === s.toLowerCase()}
                    href={`/university/${uni.id}?sport=${encodeURIComponent(s)}`}
                    label={s}
                  />
                ))}
              </div>
            )}

            {visiblePrograms.length === 0 ? (
              <div className="card p-8 text-center text-sm text-slate-500">
                No programs match{" "}
                <span className="font-medium text-slate-700">{activeSport}</span>.
                <Link
                  href={`/university/${uni.id}`}
                  className="ml-2 text-xs text-brand-700 hover:underline"
                >
                  Show all
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visiblePrograms.map((s) => (
                  <ProgramCard
                    key={s.id}
                    schoolId={s.id}
                    sport={s.sport}
                    divisionFriendly={divisionLabel(s.division)}
                    conference={s.conference ?? uni.conference ?? null}
                    coaches={s.coaches.map((c) => {
                      const wsum = c.reviews.reduce((acc, r) => acc + (r.weight || 1), 0);
                      const sum = c.reviews.reduce(
                        (acc, r) => acc + r.overall * (r.weight || 1),
                        0
                      );
                      return {
                        id: c.id,
                        name: c.name,
                        title: c.title ?? "Coach",
                        rating: wsum > 0 ? sum / wsum : 0,
                        reviewCount: c.reviews.length,
                      };
                    })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Reviews ({sorted.length}
            {minRating !== null && uni.reviews.length !== sorted.length
              ? ` of ${uni.reviews.length}`
              : ""}
            )
          </h2>
          <div className="card p-4">
            <RatingFilter current={minRating} buildHref={(v) => buildHref("minRating", v)} />
          </div>
          {!canInteract && session?.user && <UpgradePrompt />}
          {sorted.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">
              {minRating !== null
                ? `No reviews at ${minRating}+ stars. Try a lower threshold.`
                : "No reviews yet."}
            </div>
          ) : (
            sorted.map((r, idx) => (
              <div key={r.id}>
                <ReviewCard review={toCard(r)} canInteract={canInteract} />
                {idx === 1 && <AdSlot variant="between" className="mt-4" />}
              </div>
            ))
          )}
          <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            {ANONYMITY_DISCLAIMER}
          </div>
        </div>

        <aside className="space-y-4">
          <AdSlot variant="sidebar" />
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Athletic programs</h3>
            {uni.schools.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No programs listed yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {uni.schools.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/school/${s.id}`}
                      className="truncate hover:text-brand-700 hover:underline"
                    >
                      {s.sport}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {s.coaches.length} {s.coaches.length === 1 ? "coach" : "coaches"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Dorms</h3>
            {uni.dorms.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No housing data yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {uni.dorms.map((d) => (
                  <li key={d.id}>
                    <Link href={`/dorm/${d.id}`} className="hover:underline">
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold">Campus dining</h3>
            {uni.diningHalls.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No dining data yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {uni.diningHalls.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2">
                    <span>{d.name}</span>
                    {d.location && (
                      <span className="text-xs text-slate-500">{d.location}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold">Athletic facilities</h3>
            {uni.facilities.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No facility data yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {uni.facilities.map((f) => (
                  <li key={f.id} className="flex flex-col">
                    <span>{f.name}</span>
                    <span className="text-xs text-slate-500">
                      {[f.facilityType, f.sport].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function SportPill({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </Link>
  );
}

interface ProgramCardCoach {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviewCount: number;
}

function ProgramCard({
  schoolId,
  sport,
  divisionFriendly,
  conference,
  coaches,
}: {
  schoolId: string;
  sport: string;
  divisionFriendly: string;
  conference: string | null;
  coaches: ProgramCardCoach[];
}) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{sport}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {divisionFriendly}
            </span>
            {conference && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {conference}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/school/${schoolId}`}
            className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-600 hover:text-white"
          >
            View program →
          </Link>
        </div>
      </div>

      {coaches.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          No coaches added yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {coaches.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/coach/${c.id}`}
                  className="block truncate font-medium text-slate-900 hover:text-brand-700 hover:underline"
                >
                  {c.name}
                </Link>
                <div className="truncate text-xs text-slate-500">{c.title}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <GradeBadge
                  rating={c.rating}
                  reviewCount={c.reviewCount}
                  size="sm"
                  showPercentage={false}
                  showCount={false}
                />
                <Link
                  href={`/coach/${c.id}`}
                  className="hidden rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 sm:inline-block"
                >
                  View
                </Link>
                <Link
                  href={`/review/new?type=COACH&coachId=${c.id}`}
                  className="rounded-md bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                >
                  Review
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgramsEmpty({ universityName }: { universityName: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
        🏟️
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        No programs listed yet
      </h3>
      <p className="max-w-md text-sm text-slate-600">
        We haven&rsquo;t imported athletic programs for {universityName} yet.
        Request a program below and we&rsquo;ll add it from official sources.
      </p>
      <Link
        href={`/request-school?q=${encodeURIComponent(universityName)}`}
        className="btn-primary mt-1"
      >
        Request a program
      </Link>
    </div>
  );
}

function toCard(r: any) {
  return {
    id: r.id,
    reviewType: r.reviewType as ReviewType,
    title: r.title,
    body: r.body,
    ratings: r.ratings as Record<string, number>,
    overall: r.overall,
    helpfulCount: r.helpfulCount,
    createdAt: r.createdAt,
    isAnonymous: r.isAnonymous ?? true,
    author: r.author,
  };
}
