import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedDormProfile } from "@/lib/cache";
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
import { UniversityThemeScope } from "@/components/theme/UniversityThemeScope";
import { UniversityHero } from "@/components/theme/UniversityHero";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DormProfilePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // Cached at the lib level — see src/lib/cache.ts. Busted on review
  // mutations via revalidateTag("reviews").
  const dorm = await getCachedDormProfile(params.id);
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

  // Dorm pages inherit the *parent university's* theme so a Stanford dorm
  // and the Stanford university page feel like one product surface.
  // `variant="soft"` keeps the dorm hero quieter than the parent's full-
  // gradient hero — they shouldn't compete visually when a user clicks
  // through from one to the other.
  return (
    <UniversityThemeScope university={dorm.university} className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/search?kind=dorm" className="hover:underline">Dorms</Link>
        <span className="mx-1">/</span>
        <Link href={`/university/${dorm.universityId}`} className="hover:underline">
          {dorm.university.name}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{dorm.name}</span>
      </nav>

      <UniversityHero
        variant="soft"
        title={dorm.name}
        eyebrow={`Dorm · ${dorm.university.name}`}
        subtitle={dorm.description ?? undefined}
        actions={<GradeBadge rating={overall} reviewCount={dorm.reviews.length} size="lg" />}
        footer={
          <Link
            href={`/review/new?type=DORM&dormId=${dorm.id}`}
            className="btn-primary text-sm"
          >
            Review this dorm
          </Link>
        }
      />

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
    </UniversityThemeScope>
  );
}
