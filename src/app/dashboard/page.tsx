import Link from "next/link";
import { redirect } from "next/navigation";
import {
  allowedReviewTypes,
  canParticipate,
  getSession,
  groupTypeForRole,
  isPaymentVerified,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/Badge";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ManageBillingButton } from "@/components/ManageBillingButton";
import { GROUP_TYPE_LABELS } from "@/lib/groups";
import { UserRole, VerificationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in?callbackUrl=/dashboard");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: {
      reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      favorites: {
        include: { coach: true, university: true, dorm: true, school: { include: { university: true } } },
      },
      subscription: true,
    },
  });

  const paid = isPaymentVerified(session);
  const verified = user.verificationStatus === VerificationStatus.VERIFIED;
  const myGroupType = groupTypeForRole(user.role);
  const reviewTypes = allowedReviewTypes(session);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user.name?.split(" ")[0] ?? "friend"}.</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge role={user.role} />
            <span className="text-slate-400">·</span>
            <span>payment {paid ? "verified" : "—"}</span>
            <span className="text-slate-400">·</span>
            <span>role {user.verificationStatus.toLowerCase()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {reviewTypes.length > 0 && (
            <Link href="/review/new" className="btn-primary">Write a review</Link>
          )}
          <Link href="/groups" className="btn-secondary">Verified Groups</Link>
          {paid && !verified && user.role !== UserRole.VIEWER && (
            <Link href="/verification" className="btn-secondary">Finish verification</Link>
          )}
          {paid && <ManageBillingButton />}
        </div>
      </div>

      {/* Two-layer status banners */}
      {!paid && (
        <div className="mt-6">
          <UpgradePrompt />
        </div>
      )}

      {paid && !verified && user.role !== UserRole.VIEWER && (
        <div className="mt-6 card p-5 bg-amber-50 border-amber-200">
          <h3 className="text-base font-semibold text-amber-900">Verify your role to unlock posting</h3>
          <p className="mt-1 text-sm text-amber-800">
            Payment is complete. Finish role verification to start posting reviews
            {myGroupType ? ` and join ${GROUP_TYPE_LABELS[myGroupType]}` : ""}.
          </p>
          <Link href="/verification" className="btn-primary mt-3 inline-flex">
            Continue verification
          </Link>
        </div>
      )}

      {paid && verified && myGroupType && (
        <div className="mt-6 card p-5 bg-emerald-50 border-emerald-200">
          <h3 className="text-base font-semibold text-emerald-900">You're verified.</h3>
          <p className="mt-1 text-sm text-emerald-800">
            You can post reviews you're entitled to and participate in {GROUP_TYPE_LABELS[myGroupType]}.
          </p>
        </div>
      )}

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Your reviews</h2>
          <div className="mt-3 space-y-3">
            {user.reviews.length === 0 ? (
              <div className="card p-6 text-sm text-slate-500">You haven't posted any reviews yet.</div>
            ) : (
              user.reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-slate-500">{r.reviewType}</div>
                    <div className="text-sm font-semibold">{r.overall.toFixed(1)} / 5</div>
                  </div>
                  {r.title && <div className="mt-1 font-medium">{r.title}</div>}
                  <div className="mt-1 line-clamp-2 text-sm text-slate-600">{r.body}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Saved favorites</h2>
          <div className="mt-3 space-y-3">
            {user.favorites.length === 0 ? (
              <div className="card p-6 text-sm text-slate-500">No favorites yet.</div>
            ) : (
              user.favorites.map((f) => {
                const label = f.coach?.name
                  ?? f.university?.name
                  ?? f.dorm?.name
                  ?? (f.school ? `${f.school.university.name} ${f.school.sport}` : "Saved");
                const href = f.coach
                  ? `/coach/${f.coach.id}`
                  : f.university
                  ? `/university/${f.university.id}`
                  : f.dorm
                  ? `/dorm/${f.dorm.id}`
                  : "#";
                return (
                  <Link key={f.id} href={href} className="card flex items-center justify-between p-4 hover:shadow-card">
                    <span>{label}</span>
                    <span className="text-sm text-brand-700">View →</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
