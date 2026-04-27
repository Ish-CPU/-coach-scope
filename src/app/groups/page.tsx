import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canParticipate, getSession, groupTypeForRole } from "@/lib/permissions";
import { GROUP_TYPE_DESCRIPTIONS, GROUP_TYPE_LABELS } from "@/lib/groups";
import { GroupType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getSession();
  const myType = session?.user ? groupTypeForRole(session.user.role) : null;

  const typeRaw = (Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type) as
    | GroupType
    | undefined;

  const groups = await prisma.group.findMany({
    where: typeRaw ? { groupType: typeRaw } : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: 60,
    include: { _count: { select: { members: true, posts: true } } },
  });

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Verified Groups</h1>
          <p className="mt-1 text-sm text-slate-600">
            Audience-segmented community spaces. Free users can preview; participation requires
            verification.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Verified Groups are included with your Verified subscription.
          </p>
        </div>
        {canParticipate(session) && myType && (
          <Link href="/groups/new" className="btn-primary">
            Create a {myType.replace("_GROUP", "").toLowerCase()} group
          </Link>
        )}
        {!canParticipate(session) && (
          <Link href="/pricing" className="btn-primary">Subscribe to participate</Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <FilterChip href="/groups" active={!typeRaw}>All audiences</FilterChip>
        {(Object.keys(GROUP_TYPE_LABELS) as GroupType[]).map((t) => (
          <FilterChip key={t} href={`/groups?type=${t}`} active={typeRaw === t}>
            {GROUP_TYPE_LABELS[t]}
          </FilterChip>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {groups.length === 0 ? (
          <div className="card col-span-full p-8 text-center text-sm text-slate-500">
            No groups yet. Be the first to create one.
          </div>
        ) : (
          groups.map((g) => {
            const canPost = myType === g.groupType;
            return (
              <Link
                key={g.id}
                href={`/groups/${g.slug}`}
                className="card flex flex-col p-4 hover:shadow-card transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-slate-400">
                    {GROUP_TYPE_LABELS[g.groupType]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {g._count.members} members · {g._count.posts} posts
                  </span>
                </div>
                <h3 className="mt-1 text-base font-semibold text-slate-900">{g.name}</h3>
                {g.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{g.description}</p>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  {GROUP_TYPE_DESCRIPTIONS[g.groupType]}
                  {!canPost && session?.user && " · preview only for your role"}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}
