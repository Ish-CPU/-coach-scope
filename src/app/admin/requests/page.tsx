import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import type { RequestStatus } from "@prisma/client";
import { RequestActionButtons } from "./RequestActionButtons";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { status?: string };
}

const STATUS_TABS: { label: string; value: RequestStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Needs review", value: "NEEDS_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

function parseStatus(raw: string | undefined): RequestStatus | null {
  switch (raw) {
    case "PENDING":
    case "APPROVED":
    case "REJECTED":
    case "NEEDS_REVIEW":
      return raw;
    default:
      return null;
  }
}

export default async function AdminRequestsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");

  const statusFilter = parseStatus(searchParams.status);
  // Default view = PENDING (the queue admins actually work).
  const where = statusFilter
    ? { status: statusFilter }
    : searchParams.status === "ALL"
    ? {}
    : { status: "PENDING" as RequestStatus };

  const requests = await safe(
    () =>
      prisma.programRequest.findMany({
        where,
        orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    [],
    "admin:requests:list"
  );

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">School / program requests</h1>
      <p className="mt-1 text-sm text-slate-600">
        Athletes and visitors submit these from <code>/request-school</code>.
        Approve once you&rsquo;ve imported the school + program; reject if it
        looks fake or off-platform.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active =
            (statusFilter === t.value) ||
            (!statusFilter && t.value === "PENDING" && searchParams.status !== "ALL") ||
            (searchParams.status === "ALL" && t.value === "ALL");
          const href = `/admin/requests?status=${t.value}`;
          return (
            <a
              key={t.value}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-6 overflow-x-auto">
        {requests.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">
            Nothing in this queue.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2">School</th>
                <th className="pb-2">Sport</th>
                <th className="pb-2">Division</th>
                <th className="pb-2">Conference</th>
                <th className="pb-2">Requester</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Submitted</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-3 font-medium text-slate-900">
                    {r.schoolName}
                    {r.notes && (
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        {r.notes.length > 140
                          ? r.notes.slice(0, 140) + "…"
                          : r.notes}
                      </p>
                    )}
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      {r.athleticsUrl && (
                        <a
                          href={r.athleticsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-700 hover:underline"
                        >
                          athletics ↗
                        </a>
                      )}
                      {r.rosterUrl && (
                        <a
                          href={r.rosterUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-700 hover:underline"
                        >
                          roster ↗
                        </a>
                      )}
                    </p>
                  </td>
                  <td className="py-3 text-slate-700">{r.sport}</td>
                  <td className="py-3 text-slate-700">{r.division ?? "—"}</td>
                  <td className="py-3 text-slate-700">{r.conference ?? "—"}</td>
                  <td className="py-3 text-slate-700">
                    {r.requesterEmail ?? <span className="text-slate-400">anon</span>}
                    {r.requesterRole && (
                      <span className="ml-1 text-xs text-slate-500">
                        ({r.requesterRole})
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3 text-xs text-slate-500">
                    {r.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3 text-right">
                    <RequestActionButtons id={r.id} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  const palette: Record<RequestStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    NEEDS_REVIEW: "bg-orange-100 text-orange-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
