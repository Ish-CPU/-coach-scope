/**
 * Normalization helpers for the CSV importer's dedupe layer.
 *
 * The goal is to recognize that "University of Texas at Austin",
 * "University of Texas at Austin ", "university of texas at austin", and
 * "University  of  Texas  at  Austin" all refer to the same row — without
 * silently merging genuinely different schools (e.g. "University of Texas"
 * and "University of Texas at Austin" remain distinct unless their slugs
 * match).
 */

/**
 * Lowercase + trim + collapse whitespace + drop apostrophes.
 *
 * - Trim leading/trailing whitespace.
 * - Lowercase.
 * - Collapse runs of whitespace into a single space.
 * - Strip ASCII apostrophes and curly apostrophes — "Saint Mary's" and
 *   "Saint Marys" become the same string.
 *
 * This is intentionally narrow: it does NOT strip punctuation, expand
 * abbreviations, or remove common words. We want "U of T" and "University
 * of Texas" to stay distinct.
 */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * URL-friendly slug: lowercase, alphanumeric + dash, max 96 chars.
 * Empty input returns null so callers can skip slug-based lookups.
 */
export function normalizeSlug(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Treat null + undefined as equivalent and compare Date instances by epoch.
 * Used by the per-type "isUnchanged" comparators.
 */
export function fieldEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** All listed field accessors must be field-equal. */
export function recordsEqual<T extends Record<string, unknown>>(
  a: T,
  b: Partial<T>,
  keys: readonly (keyof T)[]
): boolean {
  for (const k of keys) {
    if (!fieldEqual(a[k], b[k])) return false;
  }
  return true;
}
