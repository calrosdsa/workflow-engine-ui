import { useEffect, useState } from 'react'

// Builder-shell light/dark toggle — separate from ThemeProvider.tsx, which
// is the RUNTIME's per-tenant theme system (scoped to a published app's
// subtree via inline custom properties). This hook controls the one global
// `.light` class on <html> that index.css's own `.light` override block
// (added per ragflow-dna.md's Light mode section) reads. Defaults to dark
// since that's the shell's existing fixed baseline (design.md) — an
// unvisited browser sees no change until the user opts into light mode.
const STORAGE_KEY = 'builder-theme'
type BuilderTheme = 'dark' | 'light'

function readStored(): BuilderTheme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

function applyClass(theme: BuilderTheme) {
  document.documentElement.classList.toggle('light', theme === 'light')
}

// Runs once at module load (before React mounts) so the correct class is
// already on <html> for first paint — avoids a light-shell flash on a
// browser that previously chose light mode.
applyClass(readStored())

export function useBuilderTheme() {
  const [theme, setTheme] = useState<BuilderTheme>(readStored)

  useEffect(() => {
    applyClass(theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}
