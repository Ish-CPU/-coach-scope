import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  canParticipateInGroup,
  describeGate,
  getSession,
} from "@/lib/permissions";
import { Badge } from "@/components/Badge";
import { VoteButtons } from "@/components/groups/VoteButtons";
import { CommentForm } from "@/components/groups/CommentForm";
import { CommentList } from "@/components/groups/CommentList";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { anonymousDisplayName, ANONYMITY_DISCLAIMER } from "@/lib/anonymous";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: { slug: string; postId: string };
}) {
  const post = await prisma.groupPost.findUnique({
    where: { id: params.postId },
    include: {
      group: true,
      author: { select: { id: true, role: true, verificationStatus: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, role: true, verificationStatus: true } },
        },
      },
    },
  });
  if (!post || post.group.slug !== params.slug || post.status !== "PUBLISHED") {
    notFound();
  }

  const session = await getSession();
  const canPost = canParticipateInGroup(session, post.group.groupType);

  const yourVote = session?.user?.id
    ? await prisma.groupPostVote.findUnique({
        where: { userId_postId: { userId: session.user.id, postId: post.id } },
      })
    : null;

  return (
    <div className="container-page py-8">
      <nav className="mb-3 text-xs text-slate-500">
        <Link href="/groups" className="hover:underline">Verified Groups</Link>
        <span className="mx-1">/</span>
        <Link href={`/groups/${post.group.slug}`} className="hover:underline">{post.group.name}</Link>
      </nav>

      <article className="card flex gap-4 p-6">
        <VoteButtons
          postId={post.id}
          initialScore={post.totalScore}
          initialVote={(yourVote?.value as 1 | -1 | undefined) ?? 0}
          canVote={canPost}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{anonymousDisplayName(post.author.role)}</span>
            <Badge role={post.author.role} compact />
            <span>·</span>
            <span>{new Date(post.createdAt).toLocaleString()}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{post.title}</h1>
          <div className="mt-3 whitespace-pre-line text-sm text-slate-800">{post.body}</div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span>👍 {post.upvoteCount}</span>
            <span>👎 {post.downvoteCount}</span>
            <span>💬 {post.commentCount}</span>
          </div>
        </div>
      </article>

      {!canPost && (
        <div className="mt-6">
          <UpgradePrompt
            message={
              session?.user
                ? describeGate("wrong-role", { groupType: post.group.groupType })
                : describeGate("not-signed-in")
            }
          />
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Comments ({post.comments.length})</h2>
        {canPost && (
          <div className="mt-3">
            <CommentForm postId={post.id} />
          </div>
        )}
        <div className="mt-4">
          <CommentList comments={post.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            parentId: c.parentId,
            author: c.author,
          }))} />
        </div>
      </section>

      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
        {ANONYMITY_DISCLAIMER}
      </div>
    </div>
  );
}
