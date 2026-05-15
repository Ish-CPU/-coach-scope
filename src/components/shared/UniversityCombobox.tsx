"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface UniversityOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

interface Props {
  /** Currently selected universityId (controlled). */
  value: string;
  /** Called when the user picks a row or clears the selection. */
  onChange: (universityId: string, university: UniversityOption | null) => void;
  /** Optional label override. */
  label?: string;
  /** Optional placeholder for the search input. */
  placeholder?: string;
  /** Disable the whole combobox. */
  disabled?: boolean;
  /** Mark required for HTML form validation purposes. */
  required?: boolean;
}

const DEBOUNCE_MS = 200;

/**
 * Typeahead picker for `University` rows. Hits `/api/universities/search`
 * for live results — there is intentionally no preloaded list of every
 * university (the DB can have hundreds of rows). On first focus we show
 * the first 25 alphabetical so the user always has something to scroll.
 *
 * Selection sets `universityId` on the parent form via `onChange`. The
 * second arg of `onChange` is the full row so callers can show the
 * selected name/city/state without a follow-up fetch.
 */
export function UniversityCombobox({
  value,
  onChange,
  label = "University",
  placeholder = "Search by name, city, or state…",
  disabled = false,
  required = false,
}: Props) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<UniversityOption[]>([]);
  const [selected, setSelected] = useState<UniversityOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);

  // Debounced fetch. We always run a search (empty query → first 25
  // alphabetical) so the dropdown is never empty on first focus.
  useEffect(() => {
    if (!open) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/universities/search?q=${encodeURIComponent(query)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("search failed");
        const json = (await res.json()) as { universities: UniversityOption[] };
        // Late-arriving responses for stale queries shouldn't overwrite a
        // newer result — drop anything but the most recent in-flight call.
        if (seq === requestSeq.current) {
          setResults(json.universities ?? []);
        }
      } catch {
        if (seq === requestSeq.current) {
          setError("Couldn't load universities. Try again.");
          setResults([]);
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Close dropdown when clicking outside. Important — without this the
  // results panel can stay open over the rest of the form on mobile.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(u: UniversityOption) {
    setSelected(u);
    setQuery("");
    setOpen(false);
    onChange(u.id, u);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    onChange("", null);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="label">
        {label}
      </label>

      {/* When a university is selected we collapse the search input into a
          chip + clear button. Re-clicking "Change" reopens the search. */}
      {selected ? (
        <div className="input flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">
              {selected.name}
            </div>
            {(selected.city || selected.state) && (
              <div className="truncate text-[11px] text-slate-500">
                {[selected.city, selected.state].filter(Boolean).join(", ")}
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
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          /* Keep the underlying form's `required` semantics — a hidden
             field below carries the selected universityId so the browser's
             constraint validation reports a missing pick. */
          aria-required={required}
        />
      )}

      {/* Hidden field so the surrounding <form> sees the chosen id and the
          form's own `required` validation can catch unsubmitted picks. */}
      <input
        type="hidden"
        name="universityId"
        value={value}
        required={required}
      />

      {open && !selected && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && results.length === 0 && (
            <div className="p-3 text-xs text-slate-500">Searching…</div>
          )}
          {error && (
            <div className="p-3 text-xs text-red-700">{error}</div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="p-3 text-xs text-slate-500">
              No universities found.
            </div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pick(u)}
              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            >
              <div className="text-sm font-medium text-slate-900">{u.name}</div>
              {(u.city || u.state) && (
                <div className="text-[11px] text-slate-500">
                  {[u.city, u.state].filter(Boolean).join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
