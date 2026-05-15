"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { US_STATES } from "@/lib/us-states";

/**
 * State + conference filter UI for the search sidebar.
 *
 * Updates the URL (`?state=` / `?conference=`) without clobbering any other
 * filter params already on the page. State is a `<select>` of 2-letter
 * codes; conference is a free-text contains-match.
 */
export function LocationFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [state, setState] = useState(sp.get("state") ?? "");
  const [conference, setConference] = useState(sp.get("conference") ?? "");

  function pushWith(updates: Record<string, string | undefined>) {
    const usp = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v.trim().length > 0) usp.set(k, v.trim());
      else usp.delete(k);
    }
    startTransition(() => {
      router.push(`/search?${usp.toString()}`);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">State</label>
        <div className="flex gap-2">
          <select
            value={state}
            onChange={(e) => {
              const next = e.target.value;
              setState(next);
              pushWith({ state: next || undefined });
            }}
            className="input h-9 flex-1 py-0 text-sm"
          >
            <option value="">Any state</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          {state && (
            <button
              type="button"
              onClick={() => {
                setState("");
                pushWith({ state: undefined });
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              clear
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Conference</label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pushWith({ conference: conference || undefined });
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={conference}
            onChange={(e) => setConference(e.target.value)}
            placeholder="e.g. SEC, Big Ten, ACC"
            className="input h-9 flex-1 py-0 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Apply
          </button>
          {sp.get("conference") && (
            <button
              type="button"
              onClick={() => {
                setConference("");
                pushWith({ conference: undefined });
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              clear
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
