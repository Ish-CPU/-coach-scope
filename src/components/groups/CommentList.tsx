import { Badge } from "@/components/Badge";
import { anonymousDisplayName } from "@/lib/anonymous";
import type { UserRole, VerificationStatus } from "@prisma/client";

interface CommentNode {
  id: string;
  body: string;
  createdAt: string | Date;
  parentId: string | null;
  author: { id: string; role: UserRole; verificationStatus: VerificationStatus };
}

export function CommentList({ comments }: { comments: CommentNode[] }) {
  // Build a tree (depth=2 to keep UI simple)
  const byParent = new Map<string | null, CommentNode[]>();
  for (const c of comments) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  const roots = byParent.get(null) ?? [];

  if (roots.length === 0) {
    return <div className="card p-6 text-center text-sm text-slate-500">No comments yet.</div>;
  }

  return (
    <ul className="space-y-3">
      {roots.map((c) => (
        <CommentRow key={c.id} comment={c} replies={byParent.get(c.id) ?? []} />
      ))}
    </ul>
  );
}

function CommentRow({
  comment,
  replies,
}: {
  comment: CommentNode;
  replies: CommentNode[];
}) {
  return (
    <li className="card p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700">{anonymousDisplayName(comment.author.role)}</span>
        <Badge role={comment.author.role} compact />
        <span>·</span>
        <span>{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <div className="mt-2 whitespace-pre-line text-sm text-slate-800">{comment.body}</div>
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l border-slate-200 pl-3">
          {replies.map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-50 p-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{anonymousDisplayName(r.author.role)}</span>
                <Badge role={r.author.role} compact />
                <span>·</span>
                <span>{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 whitespace-pre-line text-slate-800">{r.body}</div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
