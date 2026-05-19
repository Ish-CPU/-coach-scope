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
import { UniversityThemeScope } from "@/components/theme/UniversityThemeScope";
import { UniversityHero } from "@/components/theme/UniversityHero";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CoachProfilePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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

  // Coach pages adopt the parent university's theme — they belong to that
  // school's program, so the visual identity matches the university page.
  // `variant="full"` reads as the most athletic / cinematic of the three
  // hero treatments, which suits the coach-profile context.
  return (
    <UniversityThemeScope
      university={coach.school.university}
      className="container-page py-8"
    >
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/search?kind=coach" className="hover:underline">Coaches</Link>
        <span className="mx-1">/</span>
        <Link href={`/university/${coach.school.universityId}`} className="hover:underline">
          {coach.school.university.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{coach.name}</span>
      </nav>

      <UniversityHero
        title={coach.name}
        eyebrow={
          [
            coach.title ?? "Coach",
            coach.school.sport,
            divisionLabel(coach.school.division),
            coach.school.conference ?? coach.school.university.conference,
          ]
            .filter(Boolean)
            .join(" · ")
        }
        subtitle={
          <>
            <Link
              href={`/university/${coach.school.universityId}`}
              className="underline-offset-2 hover:underline"
            >
              {coach.school.university.name}
            </Link>
            {coach.bio && (
              <span className="mt-2 block max-w-2xl opacity-90">{coach.bio}</span>
            )}
          </>
        }
        actions={<GradeBadge rating={overall} reviewCount={coach.reviews.length} size="lg" />}
        footer={
          <Link
            href={`/review/new?type=COACH&coachId=${coach.id}`}
            className="inline-flex items-center rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          >
            Write a review
          </Link>
        }
      />

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
    </UniversityThemeScope>
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
