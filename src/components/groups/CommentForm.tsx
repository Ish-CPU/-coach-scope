"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    });
    setSubmitting(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-2 p-3">
      <textarea
        className="input min-h-[80px]"
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
      />
      <div className="flex justify-end">
        <button className="btn-primary text-sm" disabled={submitting || !body.trim()}>
          {submitting ? "Posting…" : "Comment"}
        </button>
      </div>
    </form>
  );
}
