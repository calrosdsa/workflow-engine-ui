import type { ThemeConfig } from './types'

// The starting theme a brand-new app's runtime gets before its owner ever
// opens the Theme tab: deliberately its OWN identity, never the builder
// shell's own palette (a customer's CRM should not look like App Builder's
// own chrome). Replaced 2026-09-26 (DESIGN.md § Runtime default theme,
// "Printed form"): the runtime reads like a printed business form, captions
// and rules in one spot colour, values in ink. The default spot colour is a
// deep ledger green; the neutrals are near-grey on purpose, because
// mergeTheme merges colour by colour and an app that saved only its own
// primary still gets these neutrals beside its brand colour.
export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '172 70% 25%',
    secondary: '160 8% 92.5%',
    accent: '160 8% 92.5%',
    // The desk; forms and cards (surface) sit on it as sheets of paper.
    background: '160 8% 95.5%',
    surface: '150 12% 99.5%',
  },
  darkColors: {
    // Sage, not a neon green on black.
    primary: '162 38% 62%',
    secondary: '165 8% 16%',
    accent: '165 8% 16%',
    background: '170 10% 7%',
    // Lighter than the page so a sheet reads as raised in dark mode too.
    surface: '168 8% 10.5%',
  },
  typography: {
    // Atkinson Hyperlegible Next: designed for character distinction
    // (I/l/1, O/0), which is most of what a records app asks of its type:
    // ids, emails, codes and amounts. Self-hosted by runtime-main.tsx.
    fontFamily: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif",
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
