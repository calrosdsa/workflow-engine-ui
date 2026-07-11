// Canonical home for ThemeConfig — features/applications imports this
// (Application['theme']: ThemeConfig) rather than the reverse, since theme
// is a feature runtime code depends on (ThemeProvider), while
// features/applications pulls in builder-only CRUD hooks that runtime code
// must never import.
export interface ThemeConfig {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
  }
  /** Overrides applied on top of colors when resolved mode is dark. */
  darkColors?: Partial<ThemeConfig['colors']>
  typography: {
    fontFamily: string
    baseSize: string
  }
  radius: string
  shadow: 'none' | 'sm' | 'md' | 'lg'
  logoUrl?: string
  faviconUrl?: string
  appIconUrl?: string
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedThemeMode = 'light' | 'dark'
