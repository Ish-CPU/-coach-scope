"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreatePostForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/groups/${slug}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(typeof j.error === "string" ? j.error : "Could not post.");
      return;
    }
    router.push(`/groups/${slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div>
        <label className="label">Title</label>
        <input
          className="input"
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's on your mind?"
        />
      </div>
      <div>
        <label className="label">Body</label>
        <textarea
          className="input min-h-[200px]"
          required
          maxLength={10000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <button className="btn-primary" disabled={submitting}>
        {submitting ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
