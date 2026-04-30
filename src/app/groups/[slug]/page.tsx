import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safe } from "@/lib/safe-query";
import {
  canParticipateInGroup,
  describeGate,
  getSession,
} from "@/lib/permissions";
import { GROUP_TYPE_LABELS, POST_SORTS, type PostSort } from "@/lib/groups";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { PostListItem } from "@/components/groups/PostListItem";
import { ANONYMITY_DISCLAIMER } from "@/lib/anonymous";

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
  const sort: PostSort = sortRaw ?? "top";

  const group = await safe(
    () =>
      prisma.group.findUnique({
        where: { slug: params.slug },
        include: { _count: { select: { members: true, posts: true } } },
      }),
    null,
    "group:findUnique"
  );
  // Treat both "missing record" and "DB error" as 404 — better than crashing
  // to the global error boundary.
  if (!group) notFound();

  const session = await getSession();
  const canPost = canParticipateInGroup(session, group.groupType);

  const orderBy =
    sort === "new"
      ? { createdAt: "desc" as const }
      : sort === "comments"
      ? { commentCount: "desc" as const }
      : sort === "controversial"
      ? { downvoteCount: "desc" as const }
      : { totalScore: "desc" as const };

  const posts = await safe(
    () =>
      prisma.groupPost.findMany({
        where: { groupId: group.id, status: "PUBLISHED" },
        orderBy,
        take: canPost ? 50 : 5, // free / wrong-role users get a small preview
        include: {
          author: { select: { id: true, role: true, verificationStatus: true } },
          votes: session?.user?.id
            ? { where: { userId: session.user.id }, select: { value: true } }
            : false,
        },
      }),
    [],
    "group:posts"
  );

  const previewMessage = !canPost
    ? session?.user
      ? describeGate("wrong-role", { groupType: group.groupType })
      : describeGate("not-signed-in")
    : null;

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/groups" className="hover:underline">Verified Groups</Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700">{group.name}</span>
      </nav>

      <header className="card flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-slate-400">
            {GROUP_TYPE_LABELS[group.groupType]}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{group.name}</h1>
          <div className="mt-1 text-xs text-slate-500">
            {group._count.members} members · {group._count.posts} posts
          </div>
          {group.description && (
            <p className="mt-3 max-w-2xl text-sm text-slate-700">{group.description}</p>
          )}
        </div>
        {canPost ? (
          <Link href={`/groups/${group.slug}/new`} className="btn-primary">New post</Link>
        ) : (
          <Link href="/pricing" className="btn-primary">Subscribe to participate</Link>
        )}
      </header>

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
            <p className="font-medium text-slate-700">No results yet.</p>
            <p className="mt-1">Data will appear here soon.</p>
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
                author: p.author,
                yourVote:
                  Array.isArray(p.votes) && p.votes[0]
                    ? (p.votes[0].value as 1 | -1)
                    : 0,
              }}
              canVote={canPost}
            />
          ))
        )}
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
        {ANONYMITY_DISCLAIMER}
      </div>
    </div>
  );
}
