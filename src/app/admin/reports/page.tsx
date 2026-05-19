import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ReportRow } from "@/components/admin/ReportRow";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");

  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      review: {
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
          coach: true,
          school: { include: { university: true } },
          university: true,
          dorm: true,
        },
      },
    },
  });

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">Open reports ({reports.length})</h1>
      <div className="mt-6 space-y-3">
        {reports.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">Nothing in the queue. Nice work.</div>
        ) : (
          reports.map((r) => <ReportRow key={r.id} report={r as any} />)
        )}
      </div>
    </div>
  );
}
