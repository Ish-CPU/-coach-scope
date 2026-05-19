// ---------------------------------------------------------------------------
// University theme system
// ---------------------------------------------------------------------------
//
// Pure-function module — no React, no Prisma, no I/O. Safe to import from
// both server and client components.
//
// The platform's visual identity stays consistent everywhere; per-school
// theming layers on top via CSS custom properties (CSS variables). A wrapper
// element (UniversityThemeScope) emits the resolved hexes as `--theme-*`
// variables on its `style` attribute; descendants read them with Tailwind's
// arbitrary-value syntax (`bg-[var(--theme-primary)]`) or inline style.
//
// Why CSS variables instead of class permutations:
//   - Works with arbitrary hex values without growing the Tailwind class set
//   - SSR-friendly: the inline style attribute is in the initial HTML
//     payload, so the first paint is correctly themed (no hydration flash)
//   - Zero JS to apply or change a theme
//   - Easy to override deeper in the tree (nested ThemeScope for, say, an
//     embedded coach card on a different university's page)

import type { University } from "@prisma/client";
import { INSPIRED_COLORS } from "@/lib/theme/school-inspired-colors";

/**
 * Canonical shape of a resolved theme. All fields are non-optional after
 * resolution — getUniversityTheme guarantees every slot is filled by
 * falling back through DB → inspired-by table → platform default.
 */
export interface UniversityTheme {
  /** Hero / primary-button background. Always full-saturation hex. */
  primary: string;
  /** Pairs with primary for gradients + secondary surfaces. */
  secondary: string;
  /** Highlight color for tags/badges/links. */
  accent: string;
  /** Gradient start. Defaults to primary when not specified. */
  gradientFrom: string;
  /** Gradient end. Defaults to secondary when not specified. */
  gradientTo: string;
  /**
   * Foreground text color computed from `primary`'s luminance — either
   * white (#ffffff) or near-black (#0f172a). Stored on the theme so
   * descendants don't have to recompute on every render.
   */
  primaryForeground: string;
  /**
   * Source of the resolved theme. Useful for the admin UI ("this school
   * has no explicit theme; it's inheriting from the curated palette") and
   * for analytics on how many schools still need a deliberate theme
   * assignment. "inspired" is a legacy label kept for the type contract —
   * it now means "looked up from the curated school-color table".
   */
  source: "explicit" | "inspired" | "default";
}

/**
 * Neutral platform default — used when a university has neither explicit
 * DB colors nor an inspired-by table entry. Aligned with the brand-* scale
 * in tailwind.config.ts so unthemed pages still feel like part of the same
 * product, not a degraded fallback.
 */
export const DEFAULT_THEME: UniversityTheme = {
  primary: "#1f58e6",          // brand-600
  secondary: "#1846c4",        // brand-700
  accent: "#3578fb",           // brand-500
  gradientFrom: "#1f58e6",
  gradientTo: "#13357a",       // brand-900 — adds depth to the hero
  primaryForeground: "#ffffff",
  source: "default",
};

// ---------------------------------------------------------------------------
// Color math helpers — small and dependency-free
// ---------------------------------------------------------------------------

const HEX_RE = /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i;

/** Normalize "#abc" → "#aabbcc" and strip leading whitespace. */
function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.trim().match(HEX_RE);
  if (!m) return null;
  const raw = m[1];
  if (raw.length === 3) {
    return "#" + raw.split("").map((c) => c + c).join("").toLowerCase();
  }
  return "#" + raw.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

/**
 * Relative luminance per WCAG 2.x. Used to decide whether a colored
 * background needs white or dark text for AA contrast against the body.
 * Pure formula — no I/O.
 */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * Pick a foreground that meets at least WCAG AA against the given
 * background. Returns `#ffffff` for dark backgrounds and a near-black
 * (`#0f172a` — slate-900) for light ones. The threshold (0.55) is tuned
 * slightly above the math midpoint (0.5) so mid-tone reds and greens —
 * which our eye reads as "dark enough" — still get white text and don't
 * end up as gray-on-color soup.
 */
export function getContrastTextColor(backgroundHex: string): string {
  const lum = relativeLuminance(backgroundHex);
  return lum > 0.55 ? "#0f172a" : "#ffffff";
}

/**
 * Build an `rgba(r, g, b, a)` string from a hex + alpha (0..1). Used for
 * soft theme surfaces (dorm pages use a 10–15% wash of the primary as a
 * subtle background tint).
 */
export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(0,0,0,0)";
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Shape we accept as input. Loose so the resolver works equally with a
 * full Prisma `University` row or with a hand-rolled subset (e.g. a coach
 * page that only joins `university: { id, name, primaryColor, ... }`).
 */
export type UniversityThemeInput =
  | Pick<
      University,
      | "name"
      | "primaryColor"
      | "secondaryColor"
      | "accentColor"
      | "gradientFrom"
      | "gradientTo"
    >
  | null
  | undefined;

/**
 * Resolve a complete theme for a university. Always returns a fully
 * populated object — callers never have to check for null fields.
 *
 * Resolution order (per field, then collected):
 *   1. Explicit hex on the row
 *   2. Inspired-by entry keyed by case-insensitive name match
 *   3. Platform default
 *
 * The `source` field on the result reflects the dominant tier used:
 * "explicit" if ANY field came from the row, otherwise the inspired-by
 * entry name (or "default" if nothing matched).
 */
export function getUniversityTheme(uni: UniversityThemeInput): UniversityTheme {
  if (!uni) return DEFAULT_THEME;

  const explicit = {
    primary: normalizeHex(uni.primaryColor),
    secondary: normalizeHex(uni.secondaryColor),
    accent: normalizeHex(uni.accentColor),
    gradientFrom: normalizeHex(uni.gradientFrom),
    gradientTo: normalizeHex(uni.gradientTo),
  };
  const anyExplicit = Object.values(explicit).some((v) => v != null);

  const inspired = lookupInspired(uni.name);

  const primary = explicit.primary ?? inspired?.primary ?? DEFAULT_THEME.primary;
  const secondary = explicit.secondary ?? inspired?.secondary ?? DEFAULT_THEME.secondary;
  const accent =
    explicit.accent ?? inspired?.accent ?? inspired?.secondary ?? DEFAULT_THEME.accent;
  const gradientFrom = explicit.gradientFrom ?? inspired?.primary ?? primary;
  const gradientTo =
    explicit.gradientTo ?? inspired?.secondary ?? secondary;

  return {
    primary,
    secondary,
    accent,
    gradientFrom,
    gradientTo,
    primaryForeground: getContrastTextColor(primary),
    source: anyExplicit ? "explicit" : inspired ? "inspired" : "default",
  };
}

function lookupInspired(name: string): {
  primary: string;
  secondary: string;
  accent?: string;
} | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return INSPIRED_COLORS[key] ?? null;
}

// ---------------------------------------------------------------------------
// Render-time helpers — turn a theme into actual JSX-ready props
// ---------------------------------------------------------------------------

/**
 * The set of CSS custom properties a theme exposes to descendants.
 * Components consume these via `var(--theme-primary)` etc. The keys
 * mirror the field names so an admin tool can list them with no
 * additional mapping table.
 */
export interface ThemeCssVars {
  ["--theme-primary"]: string;
  ["--theme-secondary"]: string;
  ["--theme-accent"]: string;
  ["--theme-gradient-from"]: string;
  ["--theme-gradient-to"]: string;
  ["--theme-primary-foreground"]: string;
  /** 10% wash of the primary — for subtle backgrounds (dorm pages). */
  ["--theme-primary-soft"]: string;
}

/**
 * Convert a theme into the inline CSS-variable object you spread onto a
 * wrapper element. Returning a typed object (instead of a string) means
 * React handles serialization correctly, and TypeScript catches typos
 * in the var name.
 */
export function themeStyleProps(theme: UniversityTheme): ThemeCssVars {
  return {
    "--theme-primary": theme.primary,
    "--theme-secondary": theme.secondary,
    "--theme-accent": theme.accent,
    "--theme-gradient-from": theme.gradientFrom,
    "--theme-gradient-to": theme.gradientTo,
    "--theme-primary-foreground": theme.primaryForeground,
    "--theme-primary-soft": hexToRgba(theme.primary, 0.1),
  };
}

/**
 * Convenience: a curated, often-reused class-string menu so call sites
 * don't reinvent the wheel. Returns Tailwind arbitrary-value classes
 * that read from the CSS variables set by themeStyleProps().
 *
 * Naming convention: `bgPrimary`, `textOnPrimary`, etc. Stable surface
 * area — components import named entries, not the function shape, so
 * adding a new entry never breaks existing consumers.
 */
export function resolveThemeClasses() {
  return {
    bgPrimary: "bg-[var(--theme-primary)]",
    bgSecondary: "bg-[var(--theme-secondary)]",
    bgAccent: "bg-[var(--theme-accent)]",
    bgSoft: "bg-[var(--theme-primary-soft)]",
    textPrimary: "text-[var(--theme-primary)]",
    textAccent: "text-[var(--theme-accent)]",
    textOnPrimary: "text-[var(--theme-primary-foreground)]",
    borderPrimary: "border-[var(--theme-primary)]",
    borderAccent: "border-[var(--theme-accent)]",
    ringAccent: "ring-[var(--theme-accent)]",
    gradient: "bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)]",
  } as const;
}

export type ThemeClasses = ReturnType<typeof resolveThemeClasses>;
