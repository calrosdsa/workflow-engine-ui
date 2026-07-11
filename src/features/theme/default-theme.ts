import type { ThemeConfig } from './types'

// Matches the current hardcoded values in src/index.css's :root block, so a
// brand-new app's theme starts identical to today's look.
export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '221.2 83.2% 53.3%',
    secondary: '210 40% 96.1%',
    accent: '210 40% 96.1%',
    background: '0 0% 100%',
    surface: '0 0% 100%',
  },
  darkColors: {
    primary: '217.2 91.2% 59.8%',
    secondary: '217.2 32.6% 17.5%',
    accent: '217.2 32.6% 17.5%',
    background: '222.2 84% 4.9%',
    surface: '222.2 84% 4.9%',
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
