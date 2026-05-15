"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface CoachOption {
  id: string;
  name: string;
  title?: string | null;
  gender?: string | null;
}

interface Props {
  /** Currently picked schoolId — drives which coaches we fetch. */
  schoolId: string;
  /** Current selection (the Coach id). Empty string means no pick yet. */
  value: string;
  /** Called with the coach id + the full row when the user picks. */
  onChange: (coachId: string, coach: CoachOption | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Coach picker scoped to a single school (program). Hits
 * `/api/schools/[id]/coaches` to load real Coach rows for the chosen
 * program — never a static list.
 *
 * Mirrors `<UniversityCombobox>` and `<ProgramCombobox>` so all three
 * pickers behave the same way (same focus / hover / chip / clear UX,
 * same request-sequence guards, same parent-owns-state pattern). Live
 * filter is client-side substring match against `name`; for COACH
 * dropdowns this is more than enough since most schools have <50
 * coaches.
 *
 * Empty states:
 *   - no `schoolId` yet                  → "Pick a program first"
 *   - fetching                           → "Loading coaches…"
 *   - school has zero coach rows         → "No coaches found for this program"
 *   - typeahead matches nothing          → "No coaches match \"<q>\""
 *
 * Debug logging on every state transition (selectedSchoolId / fetched
 * coaches / selectedCoachId) — these are `console.debug` so the
 * production bundle stays quiet unless DevTools "Verbose" is enabled.
 */
export function CoachCombobox({
  schoolId,
  value,
  onChange,
  label = "Coach",
  required = false,
  disabled = false,
}: Props) {
  const inputId = useId();
  const [allCoaches, setAllCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!schoolId) {
      setAllCoaches([]);
      setQuery("");
      setError(null);
      // eslint-disable-next-line no-console
      console.debug("[CoachCombobox] schoolId cleared — skip fetch");
      return;
    }
    const seq = ++requestSeq.current;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // eslint-disable-next-line no-console
    console.debug("[CoachCombobox] fetching coaches for", { schoolId });
    fetch(`/api/schools/${schoolId}/coaches`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`coaches fetch ${r.status}: ${text || r.statusText}`);
        }
        return r.json() as Promise<{ coaches: CoachOption[] }>;
      })
      .then((json) => {
        if (cancelled || seq !== requestSeq.current) return;
        // eslint-disable-next-line no-console
        console.debug("[CoachCombobox] fetched coaches", {
          schoolId,
          count: (json.coaches ?? []).length,
          names: (json.coaches ?? []).map((c) => c.name),
        });
        setAllCoaches(json.coaches ?? []);
      })
      .catch((err) => {
        if (cancelled || seq !== requestSeq.current) return;
        // eslint-disable-next-line no-console
        console.error("[CoachCombobox] fetch failed", err);
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load coaches for that program."
        );
        setAllCoaches([]);
      })
      .finally(() => {
        if (cancelled || seq !== requestSeq.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected: CoachOption | null =
    value && allCoaches.find((c) => c.id === value) ? allCoaches.find((c) => c.id === value)! : null;

  const filtered = query.trim()
    ? allCoaches.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : allCoaches;

  function pick(c: CoachOption) {
    // eslint-disable-next-line no-console
    console.debug("[CoachCombobox] selected", { coachId: c.id, name: c.name });
    setQuery("");
    setOpen(false);
    onChange(c.id, c);
  }

  function clear() {
    // eslint-disable-next-line no-console
    console.debug("[CoachCombobox] selection cleared");
    setQuery("");
    onChange("", null);
  }

  const noSchool = !schoolId;
  const placeholder = noSchool
    ? "Pick a program first"
    : loading
    ? "Loading coaches…"
    : allCoaches.length === 0
    ? "No coaches found for this program"
    : "Search coaches…";

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="label">
        {label}
      </label>

      {selected ? (
        <div className="input flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">
              {selected.name}
            </div>
            {(selected.title || selected.gender) && (
              <div className="truncate text-[11px] text-slate-500">
                {[selected.title, selected.gender].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          id={inputId}
          className="input"
          type="search"
          autoComplete="off"
          value={query}
          disabled={disabled || noSchool}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          aria-required={required}
        />
      )}

      <input type="hidden" value={value} required={required} readOnly />

      {error && (
        <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {!noSchool && !loading && !error && allCoaches.length === 0 && (
        <div className="mt-1 text-[11px] text-amber-700">
          No coaches found for this program. If a coach is missing, submit a
          request at{" "}
          <a href="/request-school" className="underline">
            /request-school
          </a>
          .
        </div>
      )}

      {open && !selected && !noSchool && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="p-3 text-xs text-slate-500">Loading coaches…</div>
          )}
          {error && <div className="p-3 text-xs text-red-700">{error}</div>}
          {!loading && !error && allCoaches.length === 0 && (
            <div className="p-3 text-xs text-slate-500">
              No coaches found for this program.
            </div>
          )}
          {!loading &&
            !error &&
            allCoaches.length > 0 &&
            filtered.length === 0 && (
              <div className="p-3 text-xs text-slate-500">
                No coaches match &quot;{query}&quot;.
              </div>
            )}
          {!loading &&
            !error &&
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-900">
                  {c.name}
                </div>
                {(c.title || c.gender) && (
                  <div className="text-[11px] text-slate-500">
                    {[c.title, c.gender].filter(Boolean).join(" · ")}
                  </div>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
