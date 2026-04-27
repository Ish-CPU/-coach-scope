import Link from "next/link";
import { Badge } from "@/components/Badge";
import { VoteButtons } from "@/components/groups/VoteButtons";
import { anonymousDisplayName } from "@/lib/anonymous";
import type { UserRole, VerificationStatus } from "@prisma/client";

interface Post {
  id: string;
  title: string;
  body: string;
  upvoteCount: number;
  downvoteCount: number;
  totalScore: number;
  commentCount: number;
  createdAt: string | Date;
  author: {
    id: string;
    role: UserRole;
    verificationStatus: VerificationStatus;
  };
  yourVote: 1 | -1 | 0;
}

export function PostListItem({
  post,
  groupSlug,
  canVote,
}: {
  post: Post;
  groupSlug: string;
  canVote: boolean;
}) {
  return (
    <article className="card flex gap-4 p-4">
      <VoteButtons
        postId={post.id}
        initialScore={post.totalScore}
        initialVote={post.yourVote}
        canVote={canVote}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{anonymousDisplayName(post.author.role)}</span>
          <Badge role={post.author.role} compact />
          <span>·</span>
          <span>{new Date(post.createdAt).toLocaleString()}</span>
        </div>
        <Link href={`/groups/${groupSlug}/posts/${post.id}`}>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900 hover:underline">
            {post.title}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-600">{post.body}</p>
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <Link href={`/groups/${groupSlug}/posts/${post.id}`} className="hover:underline">
            💬 {post.commentCount} comments
          </Link>
          <span>👍 {post.upvoteCount}</span>
          <span>👎 {post.downvoteCount}</span>
        </div>
      </div>
    </article>
  );
}
