import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ThemeConfig, ThemeMode, ResolvedThemeMode } from './types'
import { pickForeground, deriveMutedForeground, deriveOverlay, ensureContrast } from './color-utils'

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
  /** Also mirror the FULL set of theme CSS custom properties (plus
   *  color-scheme/font) onto document.documentElement, and background/
   *  foreground onto document.body — for the runtime app specifically,
   *  where scopeElement is an in-page div (#runtime-root) rather than
   *  <html> itself. Two independent problems this solves:
   *  1. index.css's `body { background: hsl(var(--background)) }` rule
   *     resolves --background from body's OWN ancestor chain (:root),
   *     never from a value set on one of body's children. Without the
   *     body.style writes below, body stays on whatever :root/.dark
   *     static block happens to be in scope — invisible as long as some
   *     inner element happens to cover the full viewport (true today via
   *     RuntimeAppShell's `h-screen` wrapper) but exposed by e.g. mobile
   *     rubber-band overscroll.
   *  2. <html> otherwise keeps every OTHER token exactly as index.css's
   *     static :root block hardcodes them — the BUILDER shell's own fixed
   *     palette (teal --primary etc.), a wholly different design system
   *     from this tenant's theme, not merely a rounding drift. Custom
   *     properties inherit, so anything that isn't a DOM descendant of
   *     scopeElement — a Radix portal that mounts under document.body
   *     instead of being redirected into #runtime-root via the `container`
   *     prop most of this codebase's portals take, or simply code that
   *     calls getComputedStyle(document.documentElement) — resolves
   *     against <html> and, without mirroring the full set here, silently
   *     got the wrong design system. HtmlMenuRuntime.tsx's iframe theming
   *     hit exactly this divergence (teal on <html> vs. the app's real
   *     indigo) and worked around it locally by reading computed tokens
   *     from inside the themed subtree instead of documentElement; this
   *     closes the gap at the source so that workaround stops being
   *     necessary for anything written after it.
   *  Leave this off (default) for a scoped/isolated preview — e.g.
   *  ThemeSection's live-preview pane — which must NOT leak its draft
   *  theme onto the surrounding document. */
  syncDocument?: boolean
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
export function ThemeProvider({ theme, scopeElement, syncDocument, children }: ThemeProviderProps) {
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

    const colors = resolvedMode === 'dark' ? { ...theme.colors, ...theme.darkColors } : theme.colors
    const foreground = pickForeground(colors.background)
    // --muted/--muted-foreground/--border/--input have no color picker of
    // their own (ThemeConfig only exposes primary/secondary/accent/
    // background/surface) — every tenant background used to silently fall
    // through to whichever static index.css block happened to be in scope
    // (the builder shell's own dark :root palette in light mode, since
    // ThemeProvider never adds a `.light` class of its own — see
    // useBuilderTheme.ts for the unrelated system that does), which only
    // coincidentally read fine for a dark resolvedMode. Deriving them from
    // this same background the way --foreground already is keeps every
    // tenant theme self-consistent instead of borrowing the builder
    // shell's fixed palette. --muted-foreground is contrast-verified since
    // it's real body text; --muted/--border/--input are low-alpha tints
    // (see deriveOverlay's doc comment for the precedent).
    const borderOverlay = deriveOverlay(foreground, 10)
    const mutedForeground = deriveMutedForeground(colors.background, foreground)

    // One list, applied to every target this theme needs to reach (the
    // scope element always, <html> too when syncDocument) — a single
    // source of truth so a token added here can never drift out of sync
    // between targets the way color-scheme/background/foreground once did
    // (a bug in its own right — see syncDocument's doc comment).
    const vars: [string, string][] = [
      ['--primary', colors.primary],
      ['--primary-foreground', pickForeground(colors.primary)],
      ['--secondary', colors.secondary],
      ['--secondary-foreground', pickForeground(colors.secondary)],
      ['--accent', colors.accent],
      ['--accent-foreground', pickForeground(colors.accent)],
      ['--background', colors.background],
      ['--foreground', foreground],
      ['--muted-foreground', mutedForeground],
      ['--muted', deriveOverlay(foreground, 5)],
      ['--border', borderOverlay],
      ['--input', borderOverlay],
      ['--card', colors.surface],
      ['--card-foreground', pickForeground(colors.surface)],
      // Popover/dropdown/select-menu content (Popover, DropdownMenu, Command,
      // SelectContent — see their doc comments) reads --popover the same way
      // dialogs read --background and cards read --card, so a portaled
      // dropdown's surface tracks this app's configured theme instead of
      // silently falling back to index.css's static light/dark default.
      ['--popover', colors.surface],
      ['--popover-foreground', pickForeground(colors.surface)],
      ['--radius', theme.radius],
      ['--ring', colors.primary],
      // The primary as TEXT: captions, field labels and the active nav item
      // print in it (the runtime's "spot ink"). A tenant can pick any
      // primary, so it is contrast-checked against both surfaces a caption
      // sits on, with headroom above 4.5:1 for the 5-8% tints under hover
      // and active states.
      ['--ink', ensureContrast(colors.primary, [colors.background, colors.surface], foreground, 4.8)],
      // The boundary a form control draws (the runtime's write-on line):
      // WCAG 1.4.11 asks 3:1 against what it sits on. --muted-foreground is
      // only checked against the page background, and a field sits on the
      // surface, so this is checked against both.
      ['--field-line', ensureContrast(mutedForeground, [colors.background, colors.surface], foreground, 3)],
      // Status colours were never part of ThemeConfig, so they used to come
      // from index.css's static blocks: :root (the builder's palette) in
      // light mode, and the legacy .dark block, which only ever reached
      // #runtime-root, in dark mode, so portalled content got light-mode
      // red/green/amber on a dark page. Emitted here per resolved mode and
      // checked against this app's own surfaces, tint included, because
      // badges draw status text on a 15% wash of the same colour.
      ...statusVars(resolvedMode, [colors.background, colors.surface], foreground),
    ]

    el.classList.toggle('dark', resolvedMode === 'dark')
    // Native form controls (select dropdowns, checkboxes, date pickers) and
    // scrollbars paint from the UA's own dark/light chrome based on
    // color-scheme, inherited independently of every --variable below —
    // index.css's static blocks each declare their own (:root: dark,
    // .light: light, .dark:not(.react-flow): dark), so without setting it
    // here too, a light resolvedMode silently kept whatever color-scheme
    // was already in scope (dark, from :root) even once every other token
    // below is correctly light.
    el.style.setProperty('color-scheme', resolvedMode)
    for (const [prop, value] of vars) el.style.setProperty(prop, value)
    if (theme.typography.fontFamily) el.style.setProperty('font-family', theme.typography.fontFamily)
    if (theme.typography.baseSize) el.style.fontSize = theme.typography.baseSize

    if (syncDocument) {
      // Mirrors the SAME tokens onto <html> — document.documentElement IS
      // :root in CSS terms, so this is what makes anything outside `el`
      // (a portal under document.body, or a direct getComputedStyle(
      // document.documentElement) read) resolve this tenant's theme
      // instead of index.css's static :root block. See the doc comment on
      // syncDocument above for the full story.
      const root = document.documentElement
      root.style.setProperty('color-scheme', resolvedMode)
      // runtime.html sets this from the stored choice before first paint;
      // kept in step here so the few tokens this provider never writes
      // (runtime.css's --sidebar) follow a mode change too.
      root.setAttribute('data-rt-mode', resolvedMode)
      for (const [prop, value] of vars) root.style.setProperty(prop, value)
      if (theme.typography.fontFamily) root.style.setProperty('font-family', theme.typography.fontFamily)
      if (theme.typography.baseSize) root.style.fontSize = theme.typography.baseSize
      document.body.style.setProperty('background-color', `hsl(${colors.background})`)
      document.body.style.setProperty('color', `hsl(${foreground})`)
    }

    return () => {
      // Only clear properties this instance set — nested/unmounting
      // ThemeProviders (e.g. the live preview pane) must not blank out
      // properties an outer instance is still relying on.
      if (syncDocument) {
        const root = document.documentElement
        root.style.removeProperty('color-scheme')
        for (const [prop] of vars) root.style.removeProperty(prop)
        root.style.removeProperty('font-family')
        root.style.fontSize = ''
        document.body.style.removeProperty('background-color')
        document.body.style.removeProperty('color')
      }
      if (scopeElement) {
        el.classList.remove('dark')
        el.style.removeProperty('color-scheme')
        for (const [prop] of vars) el.style.removeProperty(prop)
        el.style.removeProperty('font-family')
        el.style.fontSize = ''
      }
    }
  }, [theme, resolvedMode, scopeElement, syncDocument])

  const value = useMemo(() => ({ mode, resolvedMode, setMode }), [mode, resolvedMode])

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}

// Base hues for success / warning / destructive, per mode. ensureContrast
// only moves them when a tenant's own surfaces leave too little headroom.
const STATUS_BASE: Record<ResolvedThemeMode, Record<'success' | 'warning' | 'destructive', string>> = {
  light: { success: '142 64% 28%', warning: '32 95% 30%', destructive: '0 72% 45%' },
  dark: { success: '142 50% 55%', warning: '38 90% 56%', destructive: '0 80% 68%' },
}

function statusVars(mode: ResolvedThemeMode, surfaces: string[], foreground: string): [string, string][] {
  return (Object.entries(STATUS_BASE[mode]) as [string, string][]).flatMap(([name, base]) => {
    const color = ensureContrast(base, surfaces, foreground, 4.5, { tintAlpha: 0.15 })
    return [[`--${name}`, color], [`--${name}-foreground`, pickForeground(color)]] as [string, string][]
  })
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}
