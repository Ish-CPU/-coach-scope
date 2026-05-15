import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/permissions";
import { canModerateReviews } from "@/lib/admin-permissions";
import { GROUP_TYPE_LABELS } from "@/lib/groups";

export const dynamic = "force-dynamic";

/**
 * Admin groups overview. Lists every group with cached counts so a
 * staff admin (anyone with `canModerateReviews`) can scan + jump into
 * a specific community. The reports queue lives at /admin/groups/reports.
 */
export default async function AdminGroupsPage() {
  const session = await getSession();
  if (!canModerateReviews(session)) redirect("/admin");

  // 200 most-active groups by member count. Re-runs are cheap (cached
  // counter columns) so we don't need pagination here.
  const [groups, openReportCount] = await Promise.all([
    prisma.group.findMany({
      orderBy: [{ memberCount: "desc" }, { postCount: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        slug: true,
        name: true,
        groupType: true,
        memberCount: true,
        postCount: true,
        accessMode: true,
        university: { select: { name: true } },
      },
    }),
    prisma.report.count({
      where: {
        status: "OPEN",
        OR: [{ postId: { not: null } }, { commentId: { not: null } }],
      },
    }),
  ]);

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
            <p className="mt-1 text-sm text-slate-600">
              Top {groups.length} groups by member count. Use{" "}
              <Link
                href="/admin/groups/reports"
                className="font-medium text-brand-700 underline"
              >
                /admin/groups/reports
              </Link>{" "}
              for the moderation queue ({openReportCount} open).
            </p>
          </div>
        </div>

        <div className="mt-6 card divide-y divide-slate-100">
          {groups.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No groups yet — run <code>npm run seed:groups</code>.
            </div>
          ) : (
            groups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.slug}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{g.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {GROUP_TYPE_LABELS[g.groupType]}
                    {g.university?.name && ` · ${g.university.name}`}
                    {" · "}
                    {g.memberCount} members · {g.postCount} posts ·{" "}
                    {g.accessMode.toLowerCase().replace(/_/g, " ")}
                  </div>
                </div>
                <span className="text-xs text-brand-700">View →</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
