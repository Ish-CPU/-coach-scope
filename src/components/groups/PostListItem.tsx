import Link from "next/link";
import { Badge } from "@/components/Badge";
import { VoteButtons } from "@/components/groups/VoteButtons";
import { anonymousDisplayName } from "@/lib/anonymous";
import { GROUP_POST_TAG_LABELS } from "@/lib/group-tags";
import type {
  GroupPostTag,
  UserRole,
  VerificationStatus,
} from "@prisma/client";

interface Post {
  id: string;
  title: string;
  body: string;
  upvoteCount: number;
  downvoteCount: number;
  totalScore: number;
  commentCount: number;
  createdAt: string | Date;
  isPinned?: boolean;
  lockedAt?: string | Date | null;
  tags?: GroupPostTag[];
  mediaUrls?: string[];
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
  showModActions = false,
}: {
  post: Post;
  groupSlug: string;
  canVote: boolean;
  /**
   * When true (viewer is a moderator of this group), surface the
   * inline mod menu — pin/unpin, lock/unlock, remove. The actual
   * actions hit /api/groups/[slug]/posts/[postId]/moderate.
   */
  showModActions?: boolean;
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
          {post.isPinned && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              📌 Pinned
            </span>
          )}
          {post.lockedAt && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
              🔒 Locked
            </span>
          )}
          <span className="font-medium text-slate-700">
            {anonymousDisplayName(post.author.role)}
          </span>
          <Badge role={post.author.role} compact />
          <span>·</span>
          <span>{new Date(post.createdAt).toLocaleString()}</span>
        </div>
        <Link href={`/groups/${groupSlug}/posts/${post.id}`}>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900 hover:underline">
            {post.title}
          </h3>
        </Link>
        {post.tags && post.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-800"
              >
                {GROUP_POST_TAG_LABELS[t]}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-600">
          {post.body}
        </p>
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="mt-2 text-[11px] text-slate-500">
            📎 {post.mediaUrls.length} media link
            {post.mediaUrls.length === 1 ? "" : "s"}
          </div>
        )}
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <Link
            href={`/groups/${groupSlug}/posts/${post.id}`}
            className="hover:underline"
          >
            💬 {post.commentCount} comments
          </Link>
          <span>👍 {post.upvoteCount}</span>
          <span>👎 {post.downvoteCount}</span>
          {showModActions && (
            <Link
              href={`/groups/${groupSlug}/posts/${post.id}#mod`}
              className="ml-auto text-brand-700 hover:underline"
            >
              Mod actions →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
