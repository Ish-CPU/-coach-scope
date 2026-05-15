import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { VerificationRow } from "@/components/admin/VerificationRow";
import { VerificationRequestStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { status?: string };
}

const STATUS_TABS: { label: string; value: VerificationRequestStatus | "OPEN" | "ALL" }[] = [
  // "OPEN" = every non-terminal status (default landing — what admins
  // actually work). HIGH_CONFIDENCE rises to the top via the sort below.
  { label: "Open queue", value: "OPEN" },
  { label: "High confidence", value: VerificationRequestStatus.HIGH_CONFIDENCE },
  { label: "Needs review", value: VerificationRequestStatus.NEEDS_REVIEW },
  { label: "Low confidence", value: VerificationRequestStatus.LOW_CONFIDENCE },
  { label: "Needs more info", value: VerificationRequestStatus.NEEDS_MORE_INFO },
  { label: "Approved", value: VerificationRequestStatus.APPROVED },
  { label: "Rejected", value: VerificationRequestStatus.REJECTED },
  { label: "All", value: "ALL" },
];

const OPEN_STATUSES = [
  VerificationRequestStatus.PENDING,
  VerificationRequestStatus.HIGH_CONFIDENCE,
  VerificationRequestStatus.NEEDS_REVIEW,
  VerificationRequestStatus.LOW_CONFIDENCE,
  VerificationRequestStatus.NEEDS_MORE_INFO,
];

function parseStatus(raw: string | undefined): VerificationRequestStatus | null {
  switch (raw) {
    case "PENDING":
    case "HIGH_CONFIDENCE":
    case "NEEDS_REVIEW":
    case "LOW_CONFIDENCE":
    case "NEEDS_MORE_INFO":
    case "APPROVED":
    case "REJECTED":
      return raw;
    default:
      return null;
  }
}

// Numeric sort weight per status — lower = higher in the queue. Drives the
// "easiest workflow" sort: HIGH_CONFIDENCE first, then NEEDS_REVIEW, then
// LOW_CONFIDENCE, then everything else.
const SORT_RANK: Record<VerificationRequestStatus, number> = {
  HIGH_CONFIDENCE: 0,
  NEEDS_REVIEW: 1,
  PENDING: 2,
  NEEDS_MORE_INFO: 3,
  LOW_CONFIDENCE: 4,
  APPROVED: 5,
  REJECTED: 6,
};

export default async function AdminVerificationsPage({ searchParams }: PageProps) {
  const explicitStatus = parseStatus(searchParams.status);
  const showOpen = !explicitStatus && searchParams.status !== "ALL";
  const where =
    searchParams.status === "ALL"
      ? {}
      : explicitStatus
      ? { status: explicitStatus }
      : { status: { in: OPEN_STATUSES } };

  // Pull a generous slice — we sort + cap in memory because the desired
  // ordering (status bucket → score desc → recency) doesn't map to a single
  // Prisma ORDER BY without a CASE expression.
  const raw = await prisma.verificationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { id: true, name: true, email: true, role: true, sport: true } } },
  });

  const requests = raw
    .slice()
    .sort((a, b) => {
      const ra = SORT_RANK[a.status] ?? 99;
      const rb = SORT_RANK[b.status] ?? 99;
      if (ra !== rb) return ra - rb;
      // Within the same bucket, higher confidence score first.
      const sa = a.confidenceScore ?? -1;
      const sb = b.confidenceScore ?? -1;
      if (sa !== sb) return sb - sa;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 200);

  // Bucket counts for the tab strip.
  const counts = await prisma.verificationRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;
  const openCount =
    OPEN_STATUSES.reduce((acc, s) => acc + (countMap[s] ?? 0), 0);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold text-slate-900">Verification requests</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sorted high-confidence first so obvious real athletes/students approve fast and
        low-confidence rows get the human review they need.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active =
            (t.value === "OPEN" && showOpen) ||
            (t.value === "ALL" && searchParams.status === "ALL") ||
            (typeof t.value === "string" && t.value !== "OPEN" && t.value !== "ALL" && explicitStatus === t.value);
          const tabCount =
            t.value === "OPEN"
              ? openCount
              : t.value === "ALL"
              ? Object.values(countMap).reduce((a, b) => a + b, 0)
              : countMap[t.value] ?? 0;
          return (
            <Link
              key={t.value}
              href={`/admin/verifications?status=${t.value}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
              {tabCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/30 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tabCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 space-y-3">
        {requests.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">Nothing in this queue.</div>
        ) : (
          requests.map((r) => (
            <VerificationRow
              key={r.id}
              request={{
                ...r,
                createdAt: r.createdAt.toISOString(),
                reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
