import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");

  const [openReports, pendingVerifications, totalReviews, totalUsers] = await Promise.all([
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.review.count(),
    prisma.user.count(),
  ]);

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-1 text-sm text-slate-600">Moderation queue & verification approvals.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open reports" value={openReports} href="/admin/reports" />
        <Stat label="Pending verifications" value={pendingVerifications} href="/admin/verifications" />
        <Stat label="Total reviews" value={totalReviews} />
        <Stat label="Total users" value={totalUsers} />
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <div className="card p-5 hover:shadow-card transition">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
