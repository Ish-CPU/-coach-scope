import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canModerateReviews } from "@/lib/admin-permissions";
import { ReviewModerationRow } from "@/components/admin/ReviewModerationRow";
import { ReviewModerationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const STATUS_TABS: { key: "all" | "pending" | "flagged"; label: string }[] = [
  { key: "all", label: "Pending + flagged" },
  { key: "pending", label: "Pending only" },
  { key: "flagged", label: "Flagged only" },
];

/**
 * Review moderation queue. Surfaces every Review row whose
 * `moderationStatus` is PENDING_REVIEW or FLAGGED, sorted by risk
 * score (highest first). Admin actions hit
 * /api/admin/reviews/[id] — see ReviewModerationRow.
 */
export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!canModerateReviews(session)) redirect("/admin");

  const tabRaw =
    (Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab) ?? "all";
  const tab = STATUS_TABS.find((t) => t.key === tabRaw)?.key ?? "all";

  const statusFilter: ReviewModerationStatus[] =
    tab === "pending"
      ? [ReviewModerationStatus.PENDING_REVIEW]
      : tab === "flagged"
      ? [ReviewModerationStatus.FLAGGED]
      : [
          ReviewModerationStatus.PENDING_REVIEW,
          ReviewModerationStatus.FLAGGED,
        ];

  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({
      where: { moderationStatus: { in: statusFilter } },
      orderBy: [{ riskScore: "desc" }, { createdAt: "asc" }],
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        reviewType: true,
        overall: true,
        trustScore: true,
        riskScore: true,
        credibilityReason: true,
        moderationStatus: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            verificationStatus: true,
            createdAt: true,
            trustScore: true,
          },
        },
        coach: { select: { id: true, name: true } },
        school: {
          select: {
            id: true,
            sport: true,
            university: { select: { name: true } },
          },
        },
        university: { select: { id: true, name: true } },
        dorm: { select: { id: true, name: true } },
      },
    }),
    prisma.review.groupBy({
      by: ["moderationStatus"],
      where: {
        moderationStatus: {
          in: [
            ReviewModerationStatus.PENDING_REVIEW,
            ReviewModerationStatus.FLAGGED,
          ],
        },
      },
      _count: { _all: true },
    }),
  ]);

  const pendingCount =
    counts.find((c) => c.moderationStatus === "PENDING_REVIEW")?._count._all ?? 0;
  const flaggedCount =
    counts.find((c) => c.moderationStatus === "FLAGGED")?._count._all ?? 0;

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Review moderation</h1>
            <p className="mt-1 text-sm text-slate-600">
              Auto-flagged + held-for-review submissions, highest risk first.
              Approve to publish, mark safe to publish without retraining the
              scorer, or remove to reject. Submissions tagged "harassment" are
              ALWAYS flagged regardless of score.
            </p>
          </div>
          <Link href="/admin/reviews/flagged" className="btn-secondary">
            Flagged-only view →
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/reviews?tab=${t.key}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                tab === t.key
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {t.key === "pending" && pendingCount > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {pendingCount}
                </span>
              )}
              {t.key === "flagged" && flaggedCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                  {flaggedCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {reviews.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">Queue is empty.</p>
              <p className="mt-1">No reviews are awaiting moderation.</p>
            </div>
          ) : (
            reviews.map((r) => <ReviewModerationRow key={r.id} review={r as any} />)
          )}
        </div>
      </div>
    </div>
  );
}
