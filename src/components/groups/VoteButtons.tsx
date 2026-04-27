"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  postId: string;
  initialScore: number;
  initialVote: 1 | -1 | 0;
  canVote: boolean;
  size?: "sm" | "md";
}

export function VoteButtons({ postId, initialScore, initialVote, canVote, size = "md" }: Props) {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<1 | -1 | 0>(initialVote);
  const [busy, setBusy] = useState(false);

  async function cast(value: 1 | -1) {
    if (!canVote || busy) return;
    setBusy(true);
    // If clicking the same direction, toggle off (value=0)
    const next: 1 | -1 | 0 = vote === value ? 0 : value;
    const optimistic = score + (next - vote);
    setVote(next);
    setScore(optimistic);
    const res = await fetch(`/api/posts/${postId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: next }),
    });
    setBusy(false);
    if (!res.ok) {
      // revert on failure
      setVote(vote);
      setScore(score);
      return;
    }
    const j = await res.json();
    if (typeof j.totalScore === "number") setScore(j.totalScore);
  }

  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => cast(1)}
        disabled={!canVote || busy}
        aria-label="Upvote"
        className={cn(
          "rounded-md p-1 transition disabled:opacity-40",
          vote === 1 ? "text-emerald-600" : "text-slate-400 hover:text-emerald-600"
        )}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className={dim}>
          <path d="M10 3l7 9H3l7-9z" />
        </svg>
      </button>
      <span
        className={cn(
          "min-w-[2ch] text-center text-xs font-bold",
          vote === 1 ? "text-emerald-700" : vote === -1 ? "text-red-600" : "text-slate-700"
        )}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => cast(-1)}
        disabled={!canVote || busy}
        aria-label="Downvote"
        className={cn(
          "rounded-md p-1 transition disabled:opacity-40",
          vote === -1 ? "text-red-600" : "text-slate-400 hover:text-red-600"
        )}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className={dim}>
          <path d="M10 17l-7-9h14l-7 9z" />
        </svg>
      </button>
    </div>
  );
}
