import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import {
  canPostInGroup,
  canViewGroup,
  describeGate,
  getSession,
  isAdmin,
} from "@/lib/permissions";
import {
  GROUP_TYPE_LABELS,
  POST_SORTS,
  type PostSort,
} from "@/lib/groups";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { PostListItem } from "@/components/groups/PostListItem";
import { ANONYMITY_DISCLAIMER } from "@/lib/anonymous";
import { GroupType, GroupVisibility } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sortRaw = (Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort) as
    | PostSort
    | undefined;
  const sort: PostSort = sortRaw ?? "hot";

  const group = await safe(
    () =>
      prisma.group.findUnique({
        where: { slug: params.slug },
        include: {
          university: { select: { id: true, name: true } },
          school: {
            select: { id: true, sport: true, division: true, conference: true },
          },
          coach: { select: { id: true, name: true } },
          _count: { select: { members: true, posts: true } },
        },
      }),
    null,
    "group:findUnique"
  );
  if (!group) notFound();

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  // Membership lookup is needed for both the visibility check (PRIVATE
  // requires membership) and for the post-composer enable. Single round
  // trip — never duplicated.
  const membership = userId
    ? await prisma.groupMembership.findUnique({
        where: { userId_groupId: { userId, groupId: group.id } },
        select: { id: true },
      })
    : null;
  const isMember = !!membership;

  const accessShape = {
    groupType: group.groupType,
    visibility: group.visibility,
    accessMode: group.accessMode,
    lifecycleAudience: group.lifecycleAudience,
    isMember,
  };

  // PRIVATE viewers who aren't members see a stub instead of the feed.
  // VERIFIED_ONLY viewers without a verified role still see a stub.
  if (!canViewGroup(session, accessShape)) {
    return (
      <div className="container-page py-10">
        <div className="mx-auto max-w-xl card p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">{group.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {group.visibility === GroupVisibility.PRIVATE
              ? "This group is private. Ask a member to invite you."
              : "This group is open only to verified accounts. Verify your role to view posts."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/groups" className="btn-secondary">
              Back to groups
            </Link>
            {group.visibility === GroupVisibility.VERIFIED_ONLY && (
              <Link href="/verification" className="btn-primary">
                Verify your role
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const canPost = canPostInGroup(session, accessShape);

  // Pinned posts always render first regardless of the chosen sort —
  // the sort orders the rest of the feed. `pinnedAt` breaks ties when
  // multiple posts are pinned so the most recently pinned wins.
  const sortOrderBy =
    sort === "new"
      ? [{ createdAt: "desc" as const }]
      : sort === "comments"
      ? [{ commentCount: "desc" as const }]
      : sort === "controversial"
      ? [{ downvoteCount: "desc" as const }]
      : sort === "hot"
      ? // Hot is "score with a recency tilt" — order by totalScore but
        // bias newer posts so a 3-day-old all-time-best doesn't pin
        // the top of the feed forever. Approximated as totalScore desc
        // then createdAt desc.
        [{ totalScore: "desc" as const }, { createdAt: "desc" as const }]
      : [{ totalScore: "desc" as const }];
  const orderBy = [
    { isPinned: "desc" as const },
    { pinnedAt: "desc" as const },
    ...sortOrderBy,
  ];

  const posts = await safe(
    () =>
      prisma.groupPost.findMany({
        where: { groupId: group.id, status: "PUBLISHED" },
        orderBy,
        take: canPost ? 50 : 5, // free / wrong-role users get a small preview
        include: {
          author: { select: { id: true, role: true, verificationStatus: true } },
          votes: userId
            ? { where: { userId }, select: { value: true } }
            : false,
        },
      }),
    [],
    "group:posts"
  );

  // Sidebar: group moderators (master/admin can also moderate but they
  // surface in /admin not here). MODERATOR + ADMIN role rows from
  // GroupMembership; legacy isAdmin=true rows fall through too.
  const moderators = await safe(
    () =>
      prisma.groupMembership.findMany({
        where: {
          groupId: group.id,
          OR: [
            { role: { in: ["MODERATOR", "ADMIN"] } },
            { isAdmin: true },
          ],
        },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        take: 8,
        select: {
          role: true,
          isAdmin: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    [],
    "group:moderators"
  );

  // Determine whether the current viewer is a moderator — used to
  // surface inline mod actions on each post.
  const viewerIsMod = !!userId && (await canViewerModerate(userId, group.id));

  // Related groups — same university, different group. Useful sidebar so
  // a user landing on Michigan Football can jump to Michigan Community,
  // Michigan Parents, etc.
  const relatedGroups = group.universityId
    ? await safe(
        () =>
          prisma.group.findMany({
            where: {
              universityId: group.universityId,
              id: { not: group.id },
            },
            orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
            take: 6,
            select: {
              id: true,
              slug: true,
              name: true,
              groupType: true,
              memberCount: true,
            },
          }),
        [],
        "group:related"
      )
    : [];

  const previewMessage = !canPost
    ? userId
      ? describeGate("wrong-role", { groupType: group.groupType })
      : describeGate("not-signed-in")
    : null;

  // Resolve a deep link back to the entity (university / coach / school)
  // so the header can say "View on Stanford University" etc.
  const entityLink = group.coach
    ? { href: `/coach/${group.coach.id}`, label: `View coach: ${group.coach.name}` }
    : group.school
    ? { href: `/school/${group.school.id}`, label: `View program: ${group.school.sport}` }
    : group.university
    ? { href: `/university/${group.university.id}`, label: `View university: ${group.university.name}` }
    : null;

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/groups" className="hover:underline">
          Verified Groups
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{group.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          {/* --- Group header --- */}
          <header className="card flex flex-wrap items-start justify-between gap-4 p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {GROUP_TYPE_LABELS[group.groupType]}
                </span>
                {group.visibility === GroupVisibility.VERIFIED_ONLY && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    Verified-only
                  </span>
                )}
                {group.visibility === GroupVisibility.PRIVATE && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                    Private
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{group.name}</h1>
              <div className="mt-1 text-xs text-slate-500">
                {group.university?.name && <span>{group.university.name}</span>}
                {group.school?.sport && (
                  <>
                    {group.university?.name && " · "}
                    <span>{group.school.sport}</span>
                    {group.school.division && (
                      <span className="text-slate-400"> · {group.school.division}</span>
                    )}
                    {group.school.conference && (
                      <span className="text-slate-400"> · {group.school.conference}</span>
                    )}
                  </>
                )}
                {group.coach?.name && !group.school && (
                  <>
                    {group.university?.name && " · "}
                    <span>{group.coach.name}</span>
                  </>
                )}
                {" · "}
                {group._count.members} members · {group._count.posts} posts
              </div>
              {group.description && (
                <p className="mt-3 max-w-2xl text-sm text-slate-700">{group.description}</p>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-2">
              {canPost ? (
                <Link href={`/groups/${group.slug}/new`} className="btn-primary">
                  New post
                </Link>
              ) : !userId ? (
                <Link href="/sign-in?callbackUrl=/groups" className="btn-primary">
                  Sign in to post
                </Link>
              ) : (
                <Link href="/verification" className="btn-secondary">
                  Verify to participate
                </Link>
              )}
              {entityLink && (
                <Link
                  href={entityLink.href}
                  className="text-center text-xs text-brand-700 hover:underline"
                >
                  {entityLink.label}
                </Link>
              )}
            </div>
          </header>

          {/* --- Sort --- */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {POST_SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={`/groups/${group.slug}?sort=${s.value}`}
                  className={`rounded-full px-3 py-1 ${
                    sort === s.value
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {previewMessage && (
            <div className="mt-4">
              <UpgradePrompt message={`Showing a 5-post preview. ${previewMessage}`} />
            </div>
          )}

          <div className="mt-6 space-y-3">
            {posts.length === 0 ? (
              <div className="card p-8 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-700">No posts yet.</p>
                <p className="mt-1">
                  {canPost
                    ? "Be the first to start a discussion."
                    : "Posts will appear here once members start sharing."}
                </p>
              </div>
            ) : (
              posts.map((p) => (
                <PostListItem
                  key={p.id}
                  groupSlug={group.slug}
                  post={{
                    id: p.id,
                    title: p.title,
                    body: p.body,
                    upvoteCount: p.upvoteCount,
                    downvoteCount: p.downvoteCount,
                    totalScore: p.totalScore,
                    commentCount: p.commentCount,
                    createdAt: p.createdAt,
                    isPinned: p.isPinned,
                    lockedAt: p.lockedAt,
                    tags: p.tags,
                    mediaUrls: p.mediaUrls,
                    author: p.author,
                    yourVote:
                      Array.isArray(p.votes) && p.votes[0]
                        ? (p.votes[0].value as 1 | -1)
                        : 0,
                  }}
                  canVote={canPost}
                  showModActions={viewerIsMod}
                />
              ))
            )}
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            {ANONYMITY_DISCLAIMER}
          </div>
        </div>

        {/* --- Sidebar --- */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Group rules
            </h3>
            {group.rules ? (
              <p className="mt-2 whitespace-pre-line text-xs text-slate-600">
                {group.rules}
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>• Be specific, fair, and based on personal experience.</li>
                <li>• No harassment, threats, doxxing, or false claims.</li>
                <li>• Verified posts carry more weight — fake claims = removal.</li>
                <li>• Use the report button on anything that violates the rules.</li>
              </ul>
            )}
          </div>

          {moderators.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Moderators
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {moderators.map((m) => (
                  <li key={m.user.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-700">
                      {m.user.name || m.user.email}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        m.role === "ADMIN" || m.isAdmin
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m.role === "ADMIN" || m.isAdmin ? "admin" : "mod"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entityLink && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Linked
              </h3>
              <Link
                href={entityLink.href}
                className="mt-2 block text-sm font-medium text-brand-700 hover:underline"
              >
                {entityLink.label}
              </Link>
            </div>
          )}

          {relatedGroups.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Related groups
              </h3>
              <ul className="mt-2 space-y-2">
                {relatedGroups.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/groups/${r.slug}`}
                      className="block text-sm text-slate-800 hover:text-brand-700"
                    >
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {GROUP_TYPE_LABELS[r.groupType as GroupType]} · {r.memberCount} members
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Suppress unused-import warning if redirect ever becomes unused.
void redirect;

/**
 * Cheap "is this viewer a moderator of this group?" check used to
 * decide whether to surface inline mod-action affordances on the
 * post list. Kept inline (vs. calling `canModerateGroup`) because we
 * already have the membership query for the access shape.
 */
async function canViewerModerate(
  userId: string,
  groupId: string
): Promise<boolean> {
  const m = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true, isAdmin: true },
  });
  if (!m) return false;
  return m.role === "MODERATOR" || m.role === "ADMIN" || m.isAdmin;
}

void isAdmin;
