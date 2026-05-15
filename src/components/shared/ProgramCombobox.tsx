"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface ProgramOption {
  /** Prisma `School.id`. */
  id: string;
  sport: string;
  /** D1 / D2 / D3 / NAIA / NJCAA / OTHER — surfaced in the dropdown so two
   *  programs at the same school can be distinguished. */
  division?: string | null;
  conference?: string | null;
}

interface Props {
  /** Currently picked universityId — drives which programs we fetch. */
  universityId: string;
  /** Current selection (the School id). Empty string means no pick yet. */
  value: string;
  /**
   * Called with the school id + the full row when the user picks. Passing
   * `("", null)` clears the selection. The parent owns the state — this
   * component never reaches back into the parent during render or in
   * a useEffect.
   */
  onChange: (schoolId: string, school: ProgramOption | null) => void;
  /** Optional label override. */
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Program (sport) picker scoped to a single university. Hits
 * `/api/universities/[id]/schools` to load the real `School` rows for the
 * chosen university — never hardcoded, never a static list.
 *
 * Mirrors the working `<UniversityCombobox>` pattern almost line-for-line:
 *   - parent-owned `value`; component-owned `query` / `open` / cached
 *     program list
 *   - fetch fires on universityId change (and once on first open) — the
 *     dropdown is never empty if there's data to show
 *   - no useEffect side-effect reaches back into the parent's onChange
 *     (an earlier version did, which created subtle race conditions
 *     when the parent re-rendered)
 *
 * Empty states:
 *   - no `universityId` yet              → "Pick a university first."
 *   - fetching                            → "Loading programs…"
 *   - university has zero programs       → "No programs found for this
 *                                            university."
 *   - typeahead matches nothing          → "No programs match \"<q>\""
 *
 * Debug logging on every state transition (selectedUniversityId / fetched
 * programs / selectedSchoolId) — flip `console.debug` to `console.log`
 * temporarily if you want them visible in production logs.
 */
export function ProgramCombobox({
  universityId,
  value,
  onChange,
  label = "Sport / program",
  required = false,
  disabled = false,
}: Props) {
  const inputId = useId();
  const [allPrograms, setAllPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);

  // Fetch the program list whenever the picked university changes.
  // CRITICALLY this effect does NOT call onChange — clearing the
  // parent's schoolId on university-switch is the parent's job (their
  // UniversityCombobox onChange handler does it). Having both sides
  // race to clear is what made an earlier version flicker.
  useEffect(() => {
    if (!universityId) {
      setAllPrograms([]);
      setQuery("");
      setError(null);
      // eslint-disable-next-line no-console
      console.debug("[ProgramCombobox] universityId cleared — skip fetch");
      return;
    }
    const seq = ++requestSeq.current;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // eslint-disable-next-line no-console
    console.debug("[ProgramCombobox] fetching schools for", { universityId });
    fetch(`/api/universities/${universityId}/schools`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`schools fetch ${r.status}: ${text || r.statusText}`);
        }
        return r.json() as Promise<{ schools: ProgramOption[] }>;
      })
      .then((json) => {
        if (cancelled || seq !== requestSeq.current) return;
        // De-dupe on sport name so the dropdown is clean even if the DB
        // somehow has multiple School rows for the same (uni, sport) combo.
        const seen = new Set<string>();
        const deduped = (json.schools ?? []).filter((s) => {
          const key = s.sport.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // eslint-disable-next-line no-console
        console.debug("[ProgramCombobox] fetched programs", {
          universityId,
          count: deduped.length,
          sports: deduped.map((s) => s.sport),
        });
        setAllPrograms(deduped);
      })
      .catch((err) => {
        if (cancelled || seq !== requestSeq.current) return;
        // eslint-disable-next-line no-console
        console.error("[ProgramCombobox] fetch failed", err);
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load programs for that university."
        );
        setAllPrograms([]);
      })
      .finally(() => {
        if (cancelled || seq !== requestSeq.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universityId]);

  // Outside-click closes the dropdown. Same pattern as UniversityCombobox.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Resolve the selected program from `value` + the fetched list. This is
  // a derived value, not state — no useEffect, no parent re-sync needed.
  const selected: ProgramOption | null =
    value && allPrograms.find((p) => p.id === value) ? allPrograms.find((p) => p.id === value)! : null;

  const filtered = query.trim()
    ? allPrograms.filter((p) =>
        p.sport.toLowerCase().includes(query.trim().toLowerCase())
      )
    : allPrograms;

  function pick(p: ProgramOption) {
    // eslint-disable-next-line no-console
    console.debug("[ProgramCombobox] selected", {
      schoolId: p.id,
      sport: p.sport,
    });
    setQuery("");
    setOpen(false);
    onChange(p.id, p);
  }

  function clear() {
    // eslint-disable-next-line no-console
    console.debug("[ProgramCombobox] selection cleared");
    setQuery("");
    onChange("", null);
  }

  const noUniversity = !universityId;
  const placeholder = noUniversity
    ? "Pick a university first"
    : loading
    ? "Loading programs…"
    : allPrograms.length === 0
    ? "No programs found for this university"
    : "Search this university's programs…";

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="label">
        {label}
      </label>

      {selected ? (
        <div className="input flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">
              {selected.sport}
            </div>
            {(selected.division || selected.conference) && (
              <div className="truncate text-[11px] text-slate-500">
                {[selected.division, selected.conference].filter(Boolean).join(" · ")}
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
          disabled={disabled || noUniversity}
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

      {/* Hidden field for the surrounding <form>'s native required-validation. */}
      <input type="hidden" value={value} required={required} readOnly />

      {/* Visible inline error even when the dropdown is closed — so a
          fetch failure (offline / 500 / etc.) doesn't look like "we just
          didn't find any programs." */}
      {error && (
        <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {/* "No programs found" hint surfaces below the input even when the
          dropdown is closed — a disabled placeholder isn't enough to
          explain why the user can't proceed. */}
      {!noUniversity &&
        !loading &&
        !error &&
        allPrograms.length === 0 && (
          <div className="mt-1 text-[11px] text-amber-700">
            No programs found for this university. Submit a request at{" "}
            <a href="/request-school" className="underline">
              /request-school
            </a>
            .
          </div>
        )}

      {open && !selected && !noUniversity && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="p-3 text-xs text-slate-500">Loading programs…</div>
          )}
          {error && <div className="p-3 text-xs text-red-700">{error}</div>}
          {!loading && !error && allPrograms.length === 0 && (
            <div className="p-3 text-xs text-slate-500">
              No programs found for this university.
            </div>
          )}
          {!loading &&
            !error &&
            allPrograms.length > 0 &&
            filtered.length === 0 && (
              <div className="p-3 text-xs text-slate-500">
                No programs match &quot;{query}&quot;.
              </div>
            )}
          {!loading &&
            !error &&
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-900">
                  {p.sport}
                </div>
                {(p.division || p.conference) && (
                  <div className="text-[11px] text-slate-500">
                    {[p.division, p.conference].filter(Boolean).join(" · ")}
                  </div>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
