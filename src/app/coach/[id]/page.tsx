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
            where: { status: "PUBLISHED" },
            include: {
              author: { select: { id: true, role: true, verificationStatus: true } },
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

      <header className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{coach.name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            {coach.title ?? "Coach"} · {coach.school.sport} · {coach.school.university.name}
          </div>
          {coach.bio && <p className="mt-3 max-w-2xl text-sm text-slate-700">{coach.bio}</p>}
        </div>
        <div className="flex flex-col items-end gap-3">
          <GradeBadge rating={overall} reviewCount={coach.reviews.length} size="lg" />
          <Link href={`/review/new?type=COACH&coachId=${coach.id}`} className="btn-primary">
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
          <div className="card p-8 text-center text-slate-500">
            {minRating !== null
              ? `No reviews at ${minRating}+ stars. Try a lower threshold.`
              : "No reviews yet — be the first."}
          </div>
        ) : (
          sorted.map((r, idx) => (
            <div key={r.id}>
              <ReviewCard review={toCardData(r)} canInteract={canInteract} />
              {idx === 1 && <AdSlot variant="between" className="mt-4" />}
            </div>
          ))
        )}

        <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
          {ANONYMITY_DISCLAIMER} Reviews are user opinions based on personal experience. RateMyU does
          not endorse any individual review. Report any harassment, threats, or false claims.
        </div>
      </section>
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
    author: r.author,
  };
}
