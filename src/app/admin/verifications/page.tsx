import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { VerificationRow } from "@/components/admin/VerificationRow";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage() {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");

  const requests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { id: true, name: true, email: true, role: true, sport: true } } },
  });

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">Pending verifications ({requests.length})</h1>
      <div className="mt-6 space-y-3">
        {requests.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">No pending requests.</div>
        ) : (
          requests.map((r) => <VerificationRow key={r.id} request={r as any} />)
        )}
      </div>
    </div>
  );
}
