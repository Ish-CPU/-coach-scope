import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

export default async function UniversityProfilePage({ params, searchParams }: PageProps) {
  const uni = await prisma.university.findUnique({
    where: { id: params.id },
    include: {
      schools: { include: { coaches: true } },
      dorms: { orderBy: { name: "asc" } },
      diningHalls: { orderBy: { name: "asc" } },
      facilities: { orderBy: { name: "asc" } },
      reviews: {
        where: { status: "PUBLISHED" },
        include: { author: { select: { id: true, role: true, verificationStatus: true } } },
      },
    },
  });
  if (!uni) notFound();

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
            <ul className="mt-2 space-y-1 text-sm">
              {uni.schools.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span>{s.sport}</span>
                  <span className="text-xs text-slate-500">{s.coaches.length} coaches</span>
                </li>
              ))}
            </ul>
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
    author: r.author,
  };
}
