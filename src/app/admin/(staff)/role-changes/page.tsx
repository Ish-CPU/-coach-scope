/**
 * Admin queue: user-submitted role-change requests.
 *
 * Users land here via /account/settings → "Request role change." The
 * legitimate path to switch roles (athlete → alumni on graduation,
 * recruit → athlete on enrollment, etc.) without paying twice or being
 * dropped to VIEWER.
 *
 * Default view = PENDING. Tabs cover the other statuses for retro.
 * The row component handles approve/reject with a per-action note.
 */
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/permissions";
import { canApproveVerifications } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import { RequestStatus } from "@prisma/client";
import { RoleChangeRow } from "@/components/admin/RoleChangeRow";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const TABS: { label: string; value: RequestStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

function parseStatus(raw: string | undefined): RequestStatus | null {
  if (raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED") return raw;
  return null;
}

export default async function AdminRoleChangesPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!isAdmin(session)) redirect("/");
  // Defense in depth — the layout already gates on admin, but the
  // action endpoint enforces canApproveVerifications, so we mirror it
  // here so a staff admin without the perm doesn't land on a page where
  // every button errors. The page renders read-only with a banner.
  const canAct = canApproveVerifications(session);

  const statusFilter = parseStatus(searchParams.status);
  const showAll = searchParams.status === "ALL";
  const where = statusFilter
    ? { status: statusFilter }
    : showAll
    ? {}
    : { status: RequestStatus.PENDING };

  const rows = await safe(
    () =>
      prisma.roleChangeRequest.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              subscriptionStatus: true,
              verificationStatus: true,
            },
          },
        },
      }),
    [],
    "admin:role-changes:list"
  );

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">Role change requests</h1>
      <p className="mt-1 text-sm text-slate-600">
        Users submit these from <code>/account/settings</code> when their
        situation changes (graduation, transfer, recruit → enrolled).
        Approving flips their role and resets verification so they
        re-prove identity under the new role. Their subscription stays
        the same — no double-charge.
      </p>

      {!canAct && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          You don&rsquo;t have the &ldquo;approve verifications&rdquo;
          permission, so the action buttons are disabled. Ask the master
          admin to grant it if you need to work this queue.
        </div>
      )}

      <nav className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active =
            (statusFilter === t.value) ||
            (!statusFilter && t.value === "PENDING" && !showAll) ||
            (showAll && t.value === "ALL");
          const href = `/admin/role-changes?status=${t.value}`;
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
        {rows.length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">
            Nothing in this queue.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="pb-2">User</th>
                <th className="pb-2">Current → Requested</th>
                <th className="pb-2">Reason</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Submitted</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <RoleChangeRow
                  key={r.id}
                  request={{
                    id: r.id,
                    currentRole: r.currentRole,
                    requestedRole: r.requestedRole,
                    reason: r.reason,
                    status: r.status,
                    adminNote: r.adminNote,
                    createdAt: r.createdAt.toISOString(),
                    user: {
                      id: r.user.id,
                      email: r.user.email,
                      name: r.user.name,
                      role: r.user.role,
                      subscriptionStatus: r.user.subscriptionStatus,
                      verificationStatus: r.user.verificationStatus,
                    },
                  }}
                  canAct={canAct}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
