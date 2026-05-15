"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GROUP_POST_TAG_LABELS,
  GROUP_POST_TAG_ORDER,
} from "@/lib/group-tags";
import { GroupPostTag } from "@prisma/client";

/**
 * Group post composer. Adds two MVP-friendly fields on top of title +
 * body:
 *   - tags: 0-5 picks from the canonical GroupPostTag enum
 *   - mediaUrls: free-form list of public http(s) URLs (parsed
 *                client-side from a comma/newline-separated textarea —
 *                we cap at 8 and the API drops anything that isn't
 *                a safe http URL via isSafeHttpUrl)
 *
 * Stays a single-file form for now; once richer media handling lands
 * (uploads, OG image scraping) the media block can break out.
 */
export function CreatePostForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<Set<GroupPostTag>>(new Set());
  const [mediaText, setMediaText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(t: GroupPostTag) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else if (next.size < 5) next.add(t);
      return next;
    });
  }

  // Split the textarea on newlines OR commas, trim, drop blanks.
  const mediaUrls = mediaText
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/groups/${slug}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        tags: Array.from(tags),
        mediaUrls,
      }),
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
    <form onSubmit={submit} className="card space-y-4 p-4">
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

      <div>
        <label className="label">
          Tags <span className="text-slate-400">(optional — up to 5)</span>
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {GROUP_POST_TAG_ORDER.map((t) => {
            const on = tags.has(t);
            const disabled = !on && tags.size >= 5;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => toggleTag(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  on
                    ? "bg-brand-700 text-white"
                    : disabled
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {GROUP_POST_TAG_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">
          Media URLs <span className="text-slate-400">(optional — one per line, up to 8)</span>
        </label>
        <textarea
          className="input min-h-[64px] font-mono text-xs"
          value={mediaText}
          onChange={(e) => setMediaText(e.target.value)}
          placeholder="https://example.com/photo.jpg
https://twitter.com/.../status/..."
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Public http(s) links only. Anything that isn't a safe URL will be
          dropped server-side.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}
      <button className="btn-primary" disabled={submitting}>
        {submitting ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
