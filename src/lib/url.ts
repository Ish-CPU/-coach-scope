type Params = Record<string, string | string[] | undefined>;

/**
 * Build a function that returns a URL with one query param replaced
 * (or removed when the new value is null/undefined/empty), preserving
 * every other param currently on the page.
 *
 *   const href = buildHrefBuilder("/coach/abc", searchParams);
 *   href("minRating", "4")     // → /coach/abc?...&minRating=4
 *   href("minRating", null)    // → /coach/abc?... (param removed)
 */
export function buildHrefBuilder(pathname: string, current: Params) {
  return (key: string, value: string | number | null | undefined) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) {
      if (k === key) continue;
      if (typeof v === "string") usp.set(k, v);
      else if (Array.isArray(v) && v[0]) usp.set(k, v[0]);
    }
    if (value !== null && value !== undefined && value !== "") {
      usp.set(key, String(value));
    }
    const qs = usp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}
