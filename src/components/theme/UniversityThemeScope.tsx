import type { ReactNode, CSSProperties } from "react";
import {
  getUniversityTheme,
  themeStyleProps,
  type UniversityThemeInput,
  type UniversityTheme,
} from "@/lib/theme/university-theme";

// ---------------------------------------------------------------------------
// <UniversityThemeScope>
// ---------------------------------------------------------------------------
//
// Wraps a subtree and emits the resolved theme as CSS custom properties on
// a single `<div>` (or whichever tag `as` is set to). Descendants then
// read them via Tailwind's arbitrary-value syntax — e.g.
// `bg-[var(--theme-primary)]` — or via inline style.
//
// SSR & hydration:
//   This is a server component. The inline `style` attribute it emits is
//   serialized into the initial HTML payload, so the first paint is fully
//   themed. There is no JS or effect needed, hence no flicker and no
//   client-server prop drift.
//
// Nesting:
//   Inner scopes shadow outer ones (browsers do this for free with custom
//   properties). Useful when a coach page embeds, say, a card representing
//   a different university — wrap that card in a nested scope and only its
//   subtree changes.
//
// Composition:
//   `as` defaults to `"div"` but accepts any layout element. The
//   `className` prop appends to a no-op base so callers can apply layout
//   utilities without losing the inline style attribute.

interface Props {
  university: UniversityThemeInput;
  children: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  /**
   * Escape hatch: pass extra style props that get merged with the theme
   * variables. Useful when the wrapper element is ALSO the hero element
   * and needs e.g. `minHeight` set.
   */
  style?: CSSProperties;
  /**
   * Surfaced for places (admin tools, debug overlays) that want to render
   * differently depending on whether the theme was explicit, inspired, or
   * default. Doesn't affect output otherwise.
   */
  onResolvedTheme?: (theme: UniversityTheme) => void;
}

export function UniversityThemeScope({
  university,
  children,
  as: Tag = "div",
  className,
  style,
  onResolvedTheme,
}: Props) {
  const theme = getUniversityTheme(university);
  onResolvedTheme?.(theme);

  // CSS custom properties live on the same `style` attribute as any
  // caller-provided properties. React already handles `--foo`-prefixed
  // keys correctly.
  const styleWithTheme: CSSProperties = {
    ...themeStyleProps(theme),
    ...style,
  };

  const Element = Tag as unknown as "div";
  return (
    <Element
      className={className}
      style={styleWithTheme}
      data-theme-source={theme.source}
    >
      {children}
    </Element>
  );
}
