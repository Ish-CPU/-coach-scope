import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { canParticipate, getSession } from "@/lib/permissions";
import { defaultReviewSort, weightedCategoryAverage, weightedOverall } from "@/lib/review-weighting";
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

export default async function CoachProfilePage({ params, searchParams }: PageProps) {
  const coach = await safe(
    () =>
      prisma.coach.findUnique({
        where: { id: params.id },
        include: {
          school: { include: { university: true } },
          reviews: {
            where: { status: "PUBLISHED", moderationStatus: "PUBLISHED" },
            include: {
              author: { select: { id: true, name: true, role: true, verificationStatus: true } },
            },
          },
        },
      }),
    null,
    "coach:findUnique"
  );
  if (!coach) notFound();

  const session = await getSession();
  const canInteract = canParticipate(session);

  // Aggregate stays computed across ALL reviews so the headline grade is
  // honest. Only the visible review list below is filtered.
  const overall = weightedOverall(coach.reviews);

  const categories: Record<string, number> = {};
  for (const f of RATING_FIELDS.COACH) {
    if (f === "overallRating") continue;
    categories[f] = weightedCategoryAverage(coach.reviews, f);
  }

  const minRating = parseMinRating(searchParams.minRating);
  const visible = filterByMinRating(coach.reviews, minRating);
  const sorted = defaultReviewSort(visible);
  const buildHref = buildHrefBuilder(`/coach/${coach.id}`, searchParams);

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/search?kind=coach" className="hover:underline">Coaches</Link>
        <span className="mx-1">/</span>
        <Link href={`/university/${coach.school.universityId}`} className="hover:underline">
          {coach.school.university.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{coach.name}</span>
      </nav>

      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{coach.name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            {coach.title ?? "Coach"} ·{" "}
            <Link
              href={`/university/${coach.school.universityId}`}
              className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
            >
              {coach.school.university.name}
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ProgramChip>{coach.school.sport}</ProgramChip>
            <ProgramChip>{divisionLabel(coach.school.division)}</ProgramChip>
            {(coach.school.conference ?? coach.school.university.conference) && (
              <ProgramChip>
                {coach.school.conference ?? coach.school.university.conference}
              </ProgramChip>
            )}
            {coach.school.university.state && (
              <ProgramChip>{coach.school.university.state}</ProgramChip>
            )}
          </div>
          {coach.bio && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700">{coach.bio}</p>
          )}
        </div>
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-end sm:gap-3">
          <GradeBadge rating={overall} reviewCount={coach.reviews.length} size="lg" />
          <Link
            href={`/review/new?type=COACH&coachId=${coach.id}`}
            className="btn-primary whitespace-nowrap"
          >
            Write a review
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <RatingSummary overall={overall} reviewCount={coach.reviews.length} categories={categories} />
      </div>

      <AdSlot variant="banner" className="mt-6" />

      <section className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Reviews ({sorted.length}
            {minRating !== null && coach.reviews.length !== sorted.length
              ? ` of ${coach.reviews.length}`
              : ""}
            )
          </h2>
          <div className="text-xs text-slate-500">
            Sort: Verified Athletes → Parents/Students → Members → Helpful → Recent
          </div>
        </div>

        <div className="card p-4">
          <RatingFilter current={minRating} buildHref={(v) => buildHref("minRating", v)} />
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
                Try a lower threshold using the filter above.
              </p>
            </div>
          ) : (
            <div className="card flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">
                💬
              </div>
              <h3 className="text-base font-semibold text-slate-900">No reviews yet</h3>
              <p className="max-w-md text-sm text-slate-600">
                Be the first to share your experience with {coach.name}. Reviews stay
                anonymous publicly and help future athletes and families make informed
                decisions.
              </p>
              {canInteract && (
                <Link
                  href={`/review/new?type=COACH&coachId=${coach.id}`}
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
          experience. MyUniversityVerified does not endorse any individual
          review. Report any harassment, threats, or false claims.
        </div>
      </section>
    </div>
  );
}

function ProgramChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
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
