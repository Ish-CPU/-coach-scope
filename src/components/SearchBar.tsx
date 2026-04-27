"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function SearchBar({
  size = "md",
  className,
  placeholder = "Search a coach, university, or dorm...",
}: {
  size?: "md" | "lg";
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const usp = new URLSearchParams();
        if (q.trim()) usp.set("q", q.trim());
        router.push(`/search?${usp.toString()}`);
      }}
      className={cn("relative w-full", className)}
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-full border border-slate-300 bg-white pl-12 pr-28 shadow-soft focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100",
          size === "lg" ? "py-4 text-lg" : "py-3 text-base"
        )}
      />
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={cn("absolute left-4 top-1/2 -translate-y-1/2 text-slate-400", size === "lg" ? "h-6 w-6" : "h-5 w-5")}
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l3.58 3.58a1 1 0 01-1.42 1.42l-3.58-3.58A7 7 0 012 9z"
          clipRule="evenodd"
        />
      </svg>
      <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary">
        Search
      </button>
    </form>
  );
}
