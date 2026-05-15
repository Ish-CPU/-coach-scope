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

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DormProfilePage({ params, searchParams }: PageProps) {
  const dorm = await safe(
    () =>
      prisma.dorm.findUnique({
        where: { id: params.id },
        include: {
          university: true,
          reviews: {
            where: { status: "PUBLISHED" },
            include: { author: { select: { id: true, name: true, role: true, verificationStatus: true } } },
          },
        },
      }),
    null,
    "dorm:findUnique"
  );
  if (!dorm) notFound();

  const session = await getSession();
  const canInteract = canParticipate(session);

  // Aggregate stays computed across ALL reviews; filter only affects the list.
  const overall = weightedOverall(dorm.reviews);

  const categories: Record<string, number> = {};
  for (const f of RATING_FIELDS.DORM) {
    if (f === "overallExperience") continue;
    categories[f] = weightedCategoryAverage(dorm.reviews, f);
  }

  const minRating = parseMinRating(searchParams.minRating);
  const visible = filterByMinRating(dorm.reviews, minRating);
  const sorted = defaultReviewSort(visible);
  const buildHref = buildHrefBuilder(`/dorm/${dorm.id}`, searchParams);

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/search?kind=dorm" className="hover:underline">Dorms</Link>
        <span className="mx-1">/</span>
        <Link href={`/university/${dorm.universityId}`} className="hover:underline">
          {dorm.university.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{dorm.name}</span>
      </nav>

      <header className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{dorm.name}</h1>
          <div className="mt-1 text-sm text-slate-600">{dorm.university.name}</div>
          {dorm.description && <p className="mt-3 max-w-2xl text-sm text-slate-700">{dorm.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-3">
          <GradeBadge rating={overall} reviewCount={dorm.reviews.length} size="lg" />
          <Link href={`/review/new?type=DORM&dormId=${dorm.id}`} className="btn-primary">
            Review this dorm
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <RatingSummary overall={overall} reviewCount={dorm.reviews.length} categories={categories} />
      </div>

      <AdSlot variant="banner" className="mt-6" />

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold">
          Reviews ({sorted.length}
          {minRating !== null && dorm.reviews.length !== sorted.length
            ? ` of ${dorm.reviews.length}`
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
              <ReviewCard
                review={{
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
                }}
                canInteract={canInteract}
              />
              {idx === 1 && <AdSlot variant="between" className="mt-4" />}
            </div>
          ))
        )}
        <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">{ANONYMITY_DISCLAIMER}</div>
      </section>
    </div>
  );
}
