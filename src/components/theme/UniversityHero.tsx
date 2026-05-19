import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// <UniversityHero>
// ---------------------------------------------------------------------------
//
// Themed page hero: gradient background using the active theme's
// gradient-from/to CSS variables, contrast-aware foreground text, and
// optional eyebrow / meta slots. Intentionally generic — used by
// university, dorm (softer variant), coach, and group pages so the
// visual language stays consistent across surfaces.
//
// Must render INSIDE a <UniversityThemeScope> ancestor so the
// `--theme-*` CSS variables are in scope. Standalone use falls back to
// the default theme automatically (root layout doesn't currently set
// these vars; you'd get unstyled output, which is loud-and-fast feedback
// to wrap in a scope).
//
// Variants:
//   variant="full"  → bold gradient (university + coach pages)
//   variant="soft"  → 10% wash background w/ dark text (dorm pages)
//                     — same accents, less visual weight so they don't
//                       compete with the parent university hero.

interface Props {
  /** Headline. Typically the entity name. */
  title: string;
  /** Small uppercased label above the title (e.g. "University · D1 · ACC"). */
  eyebrow?: ReactNode;
  /** Subtitle or location line below the title. */
  subtitle?: ReactNode;
  /** Right-side slot — usually rating/grade badges or a CTA. */
  actions?: ReactNode;
  /** Below-the-fold slot — tabs, breadcrumbs, etc. */
  footer?: ReactNode;
  variant?: "full" | "soft";
  className?: string;
}

export function UniversityHero({
  title,
  eyebrow,
  subtitle,
  actions,
  footer,
  variant = "full",
  className,
}: Props) {
  // The two variants share layout; only the surface treatment differs.
  // Pulling them out into a base + addClasses pattern keeps the JSX
  // single-source.
  const base =
    "relative overflow-hidden rounded-2xl border border-slate-200 px-6 py-8 sm:px-10 sm:py-12";

  if (variant === "soft") {
    return (
      <header
        className={[
          base,
          // Light, contrast-safe tint of the theme primary. Text stays
          // slate so we don't need to recompute foreground per page.
          "bg-[var(--theme-primary-soft)] text-slate-900",
          className ?? "",
        ].join(" ")}
      >
        {/* Thin accent stripe inherits the theme primary at full saturation.
            Anchors the visual identity even though the background is washed
            out. */}
        <div className="absolute inset-x-0 top-0 h-1 bg-[var(--theme-primary)]" />
        <HeroBody
          title={title}
          eyebrow={eyebrow}
          subtitle={subtitle}
          actions={actions}
          footer={footer}
          tone="dark"
        />
      </header>
    );
  }

  // "full" variant — cinematic gradient. The mild radial overlay adds
  // depth without depending on a background image (which would have to
  // be per-university and would re-open the licensing question).
  return (
    <header
      className={[
        base,
        "bg-gradient-to-br from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)]",
        "text-[var(--theme-primary-foreground)]",
        // The radial highlight is a single subtle white wash at low
        // opacity — adds dimension and reads as "premium" without
        // imitating any specific school's brand pattern.
        "before:absolute before:inset-0 before:pointer-events-none",
        "before:bg-[radial-gradient(60%_60%_at_30%_20%,rgba(255,255,255,0.18),transparent)]",
        className ?? "",
      ].join(" ")}
    >
      <HeroBody
        title={title}
        eyebrow={eyebrow}
        subtitle={subtitle}
        actions={actions}
        footer={footer}
        tone="onPrimary"
      />
    </header>
  );
}

interface BodyProps
  extends Pick<Props, "title" | "eyebrow" | "subtitle" | "actions" | "footer"> {
  tone: "onPrimary" | "dark";
}

function HeroBody({ title, eyebrow, subtitle, actions, footer, tone }: BodyProps) {
  // Subtle copy color is derived from tone so we don't repeat the ternary
  // in three places. opacity-90 keeps both white-on-gradient and slate-on-
  // washed-bg readable without going out of contrast.
  const eyebrowClass =
    tone === "onPrimary"
      ? "text-xs font-semibold uppercase tracking-wider opacity-90"
      : "text-xs font-semibold uppercase tracking-wider text-slate-600";
  const subtitleClass =
    tone === "onPrimary"
      ? "mt-2 text-sm opacity-90 sm:text-base"
      : "mt-2 text-sm text-slate-700 sm:text-base";

  return (
    <div className="relative z-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className={eyebrowClass}>{eyebrow}</div>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && <p className={subtitleClass}>{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {footer && <div className="mt-5">{footer}</div>}
    </div>
  );
}
