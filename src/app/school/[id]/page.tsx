import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { canParticipate, getSession } from "@/lib/permissions";
import {
  defaultReviewSort,
  weightedCategoryAverage,
  weightedOverall,
} from "@/lib/review-weighting";
import { RATING_FIELDS } from "@/lib/review-schemas";
import { ReviewCard, type ReviewCardData } from "@/components/ReviewCard";
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

export default async function SchoolProgramPage({ params, searchParams }: PageProps) {
  const school = await safe(
    () =>
      prisma.school.findUnique({
        where: { id: params.id },
        include: {
          university: true,
          coaches: {
            orderBy: { name: "asc" },
            include: {
              // We only need the overall + weight for rollup math here —
              // the JSON ratings blob isn't required for the per-coach badge.
              reviews: {
                where: { status: "PUBLISHED" },
                select: { overall: true, weight: true },
              },
            },
          },
          // Reviews of the PROGRAM itself (not the individual coaches).
          reviews: {
            where: { status: "PUBLISHED" },
            include: {
              author: { select: { id: true, name: true, role: true, verificationStatus: true } },
            },
          },
        },
      }),
    null,
    "school:findUnique"
  );
  if (!school) notFound();

  const session = await getSession();
  const canInteract = canParticipate(session);

  // Aggregate over ALL program reviews so the headline grade is stable;
  // the rating-filter only narrows the visible list below.
  const overall = weightedOverall(school.reviews);
  const categories: Record<string, number> = {};
  for (const f of RATING_FIELDS.PROGRAM) {
    if (f === "overallRating") continue;
    categories[f] = weightedCategoryAverage(school.reviews, f);
  }

  const minRating = parseMinRating(searchParams.minRating);
  const visible = filterByMinRating(school.reviews, minRating);
  const sorted = defaultReviewSort(visible);
  const buildHref = buildHrefBuilder(`/school/${school.id}`, searchParams);

  const conferenceLine = school.conference ?? school.university.conference ?? null;

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/search?kind=school" className="hover:underline">
          Programs
        </Link>
        <span className="mx-1">/</span>
        <Link
          href={`/university/${school.universityId}`}
          className="hover:underline"
        >
          {school.university.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{school.sport}</span>
      </nav>

      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {school.university.name} {school.sport}
          </h1>
          <div className="mt-1 text-sm text-slate-600">
            <Link
              href={`/university/${school.universityId}`}
              className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
            >
              {school.university.name}
            </Link>
            {school.university.city && school.university.state && (
              <span className="text-slate-500">
                {" · "}
                {school.university.city}, {school.university.state}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>{school.sport}</Chip>
            <Chip>{divisionLabel(school.division)}</Chip>
            {conferenceLine && <Chip>{conferenceLine}</Chip>}
          </div>
          {school.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700">
              {school.description}
            </p>
          )}
        </div>
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-end sm:gap-3">
          <GradeBadge rating={overall} reviewCount={school.reviews.length} size="lg" />
          <Link
            href={`/review/new?type=PROGRAM&schoolId=${school.id}`}
            className="btn-primary whitespace-nowrap"
          >
            Review this program
          </Link>
        </div>
      </header>

      {school.reviews.length > 0 && (
        <div className="mt-6">
          <RatingSummary
            overall={overall}
            reviewCount={school.reviews.length}
            categories={categories}
          />
        </div>
      )}

      <AdSlot variant="banner" className="mt-6" />

      {/* --- Coaches list --- */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Coaches ({school.coaches.length})
          </h2>
          {school.coaches.length > 0 && (
            <span className="text-xs text-slate-500">
              Tap a coach for full profile + reviews.
            </span>
          )}
        </div>

        {school.coaches.length === 0 ? (
          <EmptyState
            title="No coaches added yet"
            body={`We haven't imported staff for the ${school.university.name} ${school.sport} program yet. If you have a verified roster link, request it and we'll add it.`}
            ctaLabel="Request this program's coaches"
            ctaHref={`/request-school?q=${encodeURIComponent(`${school.university.name} ${school.sport}`)}`}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {school.coaches.map((c) => {
              const total = c.reviews.length;
              const sum = c.reviews.reduce(
                (acc, r) => acc + r.overall * (r.weight || 1),
                0
              );
              const wsum = c.reviews.reduce((acc, r) => acc + (r.weight || 1), 0);
              const avg = wsum > 0 ? sum / wsum : 0;
              return (
                <li key={c.id}>
                  <CoachListRow
                    id={c.id}
                    name={c.name}
                    title={c.title ?? "Coach"}
                    rating={avg}
                    reviewCount={total}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* --- Program reviews --- */}
      <section className="mt-10 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Program reviews ({sorted.length}
            {minRating !== null && school.reviews.length !== sorted.length
              ? ` of ${school.reviews.length}`
              : ""}
            )
          </h2>
          <div className="text-xs text-slate-500">
            Sort: Verified Athletes → Parents/Students → Members → Helpful → Recent
          </div>
        </div>

        <div className="card p-4">
          <RatingFilter
            current={minRating}
            buildHref={(v) => buildHref("minRating", v)}
          />
        </div>

        {!canInteract && session?.user && (
          <UpgradePrompt message="Upgrade to post a review or vote on what's helpful." />
        )}

        {sorted.length === 0 ? (
          minRating !== null ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No reviews at {minRating}+ stars.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try a lower threshold above.
              </p>
            </div>
          ) : (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">
                💬
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                No reviews yet
              </h3>
              <p className="max-w-md text-sm text-slate-600">
                Be the first to share your experience with the{" "}
                {school.university.name} {school.sport} program. Reviews stay
                anonymous publicly and help future athletes and families.
              </p>
              {canInteract && (
                <Link
                  href={`/review/new?type=PROGRAM&schoolId=${school.id}`}
                  className="btn-primary mt-2"
                >
                  Write the first review
                </Link>
              )}
            </div>
          )
        ) : (
          sorted.map((r, idx) => (
            <div key={r.id}>
              <ReviewCard review={toCardData(r)} canInteract={canInteract} />
              {idx === 1 && <AdSlot variant="between" className="mt-4" />}
            </div>
          ))
        )}

        <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          {ANONYMITY_DISCLAIMER} Reviews are user opinions based on personal
          experience. Report any harassment, threats, or false claims.
        </div>
      </section>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
        🧑‍🏫
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="max-w-md text-sm text-slate-600">{body}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="btn-primary mt-1">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function CoachListRow({
  id,
  name,
  title,
  rating,
  reviewCount,
}: {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviewCount: number;
}) {
  return (
    <div className="card group flex items-center gap-3 p-4 transition hover:shadow-card">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
        🧑‍🏫
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
        <div className="truncate text-xs text-slate-500">{title}</div>
      </div>
      <div className="hidden shrink-0 sm:block">
        <GradeBadge rating={rating} reviewCount={reviewCount} size="sm" showPercentage={false} />
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Link
          href={`/coach/${id}`}
          className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"
        >
          View →
        </Link>
        <Link
          href={`/review/new?type=COACH&coachId=${id}`}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-center text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          Review
        </Link>
      </div>
    </div>
  );
}

function toCardData(r: any): ReviewCardData {
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
