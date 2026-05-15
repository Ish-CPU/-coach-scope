"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface DormOption {
  id: string;
  name: string;
  roomType?: string | null;
  bathroomType?: string | null;
}

interface Props {
  /** Currently picked universityId — drives which dorms we fetch. */
  universityId: string;
  /** Current selection (the Dorm id). Empty string means no pick yet. */
  value: string;
  onChange: (dormId: string, dorm: DormOption | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Dorm picker scoped to a single university. Hits
 * `/api/universities/[id]/dorms`. Mirrors the other combobox patterns
 * exactly. Permission gating happens at submit time in /api/reviews.
 */
export function DormCombobox({
  universityId,
  value,
  onChange,
  label = "Dorm",
  required = false,
  disabled = false,
}: Props) {
  const inputId = useId();
  const [allDorms, setAllDorms] = useState<DormOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!universityId) {
      setAllDorms([]);
      setQuery("");
      setError(null);
      return;
    }
    const seq = ++requestSeq.current;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/universities/${universityId}/dorms`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`dorms fetch ${r.status}: ${text || r.statusText}`);
        }
        return r.json() as Promise<{ dorms: DormOption[] }>;
      })
      .then((json) => {
        if (cancelled || seq !== requestSeq.current) return;
        // eslint-disable-next-line no-console
        console.debug("[DormCombobox] fetched dorms", {
          universityId,
          count: (json.dorms ?? []).length,
        });
        setAllDorms(json.dorms ?? []);
      })
      .catch((err) => {
        if (cancelled || seq !== requestSeq.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load dorms for that university."
        );
        setAllDorms([]);
      })
      .finally(() => {
        if (cancelled || seq !== requestSeq.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universityId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected: DormOption | null =
    value && allDorms.find((d) => d.id === value) ? allDorms.find((d) => d.id === value)! : null;

  const filtered = query.trim()
    ? allDorms.filter((d) =>
        d.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : allDorms;

  function pick(d: DormOption) {
    setQuery("");
    setOpen(false);
    onChange(d.id, d);
  }

  function clear() {
    setQuery("");
    onChange("", null);
  }

  const noUniversity = !universityId;
  const placeholder = noUniversity
    ? "Pick a university first"
    : loading
    ? "Loading dorms…"
    : allDorms.length === 0
    ? "No dorms found for this university"
    : "Search dorms…";

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
            {(selected.roomType || selected.bathroomType) && (
              <div className="truncate text-[11px] text-slate-500">
                {[selected.roomType, selected.bathroomType].filter(Boolean).join(" · ")}
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

      <input type="hidden" value={value} required={required} readOnly />

      {error && (
        <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {!noUniversity && !loading && !error && allDorms.length === 0 && (
        <div className="mt-1 text-[11px] text-amber-700">
          No dorms on file for this university yet.
        </div>
      )}

      {open && !selected && !noUniversity && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && <div className="p-3 text-xs text-slate-500">Loading dorms…</div>}
          {error && <div className="p-3 text-xs text-red-700">{error}</div>}
          {!loading && !error && allDorms.length === 0 && (
            <div className="p-3 text-xs text-slate-500">
              No dorms found for this university.
            </div>
          )}
          {!loading && !error && allDorms.length > 0 && filtered.length === 0 && (
            <div className="p-3 text-xs text-slate-500">
              No dorms match &quot;{query}&quot;.
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(d)}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-900">{d.name}</div>
                {(d.roomType || d.bathroomType) && (
                  <div className="text-[11px] text-slate-500">
                    {[d.roomType, d.bathroomType].filter(Boolean).join(" · ")}
                  </div>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
