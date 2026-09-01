import type { ThemeConfig } from './types'

// The starting theme a brand-new app's runtime gets before its owner ever
// opens the Theme tab — deliberately its OWN identity, separate from the
// builder shell's dark/teal RAGFlow palette (index.css's :root, a different
// system entirely; see design.md's Theme section). Updated 2026-08-31 off a
// flat, unmodified shadcn/ui "New York" starter blue (the exact values every
// un-customized shadcn project ships with — hue 221 primary, hue-210 cool-
// slate neutrals, pure #fff/near-black surfaces) to a modern indigo-violet
// identity a real tenant app can credibly ship as-is. See design.md's
// "Runtime default theme" section for the palette's reasoning.
export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '243 82% 61%',
    secondary: '240 25% 96%',
    accent: '240 25% 96%',
    background: '240 25% 99%',
    surface: '240 25% 99%',
  },
  darkColors: {
    primary: '239 91% 74%',
    secondary: '240 20% 18%',
    accent: '240 20% 18%',
    background: '240 22% 7%',
    // Lighter than --background per Hallmark's dark-mode elevation recipe
    // (higher surfaces read lighter, not darker) — cards/popovers now sit
    // visibly above the page instead of the prior defaults' flat, identical
    // background/surface pairing.
    surface: '240 18% 11%',
  },
  typography: {
    fontFamily: 'system-ui, sans-serif',
    baseSize: '16px',
  },
  radius: '0.5rem',
  shadow: 'sm',
}

/** Shallow-merges a partial saved theme over the defaults — apps saved before
 *  a new theme field existed (or with an empty {} theme) still get a
 *  complete, valid ThemeConfig, same forward-compat spirit as the form
 *  builder's layout parsing tolerating older data. */
export function mergeTheme(overrides: Partial<ThemeConfig> | undefined | null): ThemeConfig {
  if (!overrides) return DEFAULT_THEME
  return {
    colors: { ...DEFAULT_THEME.colors, ...overrides.colors },
    darkColors: { ...DEFAULT_THEME.darkColors, ...overrides.darkColors },
    typography: { ...DEFAULT_THEME.typography, ...overrides.typography },
    radius: overrides.radius ?? DEFAULT_THEME.radius,
    shadow: overrides.shadow ?? DEFAULT_THEME.shadow,
    logoUrl: overrides.logoUrl ?? DEFAULT_THEME.logoUrl,
    faviconUrl: overrides.faviconUrl ?? DEFAULT_THEME.faviconUrl,
    appIconUrl: overrides.appIconUrl ?? DEFAULT_THEME.appIconUrl,
  }
}
