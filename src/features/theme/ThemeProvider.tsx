import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemeConfig, ThemeMode, ResolvedThemeMode } from './types'
import { pickForeground } from './color-utils'

const MODE_STORAGE_KEY = 'app-theme-mode'

interface ThemeModeContextValue {
  mode: ThemeMode
  resolvedMode: ResolvedThemeMode
  setMode: (m: ThemeMode) => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider')
  return ctx
}

interface ThemeProviderProps {
  theme: ThemeConfig
  /** Element to write CSS custom properties onto. Defaults to
   *  document.documentElement (:root) — a runtime app theming the whole
   *  page. Pass a specific element (e.g. a preview-pane wrapper) to scope
   *  theming to a subtree instead, without affecting the rest of the page. */
  scopeElement?: HTMLElement | null
  children: ReactNode
}

// Hand-built CSS-custom-property theme engine — informed by (not copying)
// next-themes/shadcn's class-based dark-mode contract (a `dark` class
// toggled on the scope element), emitting THIS codebase's existing
// Tailwind v4 HSL-triplet variable format (see index.css) rather than
// next-themes' own CSS. Properties are set imperatively via
// element.style.setProperty, which composes cleanly over the `@layer base`
// :root defaults without needing !important (inline styles already win that
// cascade).
export function ThemeProvider({ theme, scopeElement, children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedMode: ResolvedThemeMode = mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    if (typeof window !== 'undefined') window.localStorage.setItem(MODE_STORAGE_KEY, m)
  }

  useEffect(() => {
    // scopeElement === null means "caller wants a scoped element but it
    // hasn't mounted yet" (e.g. ThemeSection's preview pane on first
    // render) — skip entirely rather than falling back to
    // document.documentElement, which would theme the whole page for one
    // commit and (worse) get stuck there: the cleanup below only clears
    // document.documentElement when scopeElement is truthy, so a `null`
    // this-render + real-element next-render leaves the first commit's
    // .dark class and inline vars stranded on <html> forever.
    // scopeElement === undefined still means "theme the whole page", for
    // callers that genuinely want that (none currently do — every call
    // site passes a concrete element).
    if (scopeElement === null) return
    const el = scopeElement ?? document.documentElement
    el.classList.toggle('dark', resolvedMode === 'dark')

    const colors = resolvedMode === 'dark' ? { ...theme.colors, ...theme.darkColors } : theme.colors

    el.style.setProperty('--primary', colors.primary)
    el.style.setProperty('--primary-foreground', pickForeground(colors.primary))
    el.style.setProperty('--secondary', colors.secondary)
    el.style.setProperty('--secondary-foreground', pickForeground(colors.secondary))
    el.style.setProperty('--accent', colors.accent)
    el.style.setProperty('--accent-foreground', pickForeground(colors.accent))
    el.style.setProperty('--background', colors.background)
    el.style.setProperty('--foreground', pickForeground(colors.background))
    el.style.setProperty('--card', colors.surface)
    el.style.setProperty('--card-foreground', pickForeground(colors.surface))
    el.style.setProperty('--radius', theme.radius)
    el.style.setProperty('--ring', colors.primary)
    if (theme.typography.fontFamily) el.style.setProperty('font-family', theme.typography.fontFamily)
    if (theme.typography.baseSize) el.style.fontSize = theme.typography.baseSize

    return () => {
      // Only clear properties this instance set — nested/unmounting
      // ThemeProviders (e.g. the live preview pane) must not blank out
      // properties an outer instance is still relying on.
      if (scopeElement) {
        el.classList.remove('dark')
        el.style.removeProperty('--primary')
        el.style.removeProperty('--primary-foreground')
        el.style.removeProperty('--secondary')
        el.style.removeProperty('--secondary-foreground')
        el.style.removeProperty('--accent')
        el.style.removeProperty('--accent-foreground')
        el.style.removeProperty('--background')
        el.style.removeProperty('--foreground')
        el.style.removeProperty('--card')
        el.style.removeProperty('--card-foreground')
        el.style.removeProperty('--radius')
        el.style.removeProperty('--ring')
        el.style.removeProperty('font-family')
        el.style.fontSize = ''
      }
    }
  }, [theme, resolvedMode, scopeElement])

  const value = useMemo(() => ({ mode, resolvedMode, setMode }), [mode, resolvedMode])

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}
