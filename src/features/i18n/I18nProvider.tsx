import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BASE_DICTIONARIES, BASE_LOCALES } from './dictionaries'
import type { TranslationsConfig } from './types'

const DEFAULT_LOCALE_STORAGE_KEY = 'app-locale'

export interface I18nContextValue {
  locale: string
  setLocale: (locale: string) => void
  /** Render language switchers from this, never a hardcoded locale list —
   *  it's the app's own supported_locales when the runtime has overrides,
   *  falling back to this build's bundled dictionaries in the builder
   *  (which has no single app in scope; see I18nProvider's own comment). */
  supportedLocales: string[]
  t: (key: string, vars?: Record<string, string | number>) => string
  /** Resolve a per-app CONTENT override — a form field's label/placeholder/
   *  help text/etc, keyed by features/form-builder/localize-schema.ts's
   *  `form.<formId>.field.<path>.<prop>` scheme. Deliberately separate from
   *  `t`: there is no bundled base-dictionary entry for dynamic, per-app
   *  content, so `fallback` (the field's own authored text) stands in for
   *  that layer instead — `t`'s chain ends at BASE_DICTIONARIES.en, this
   *  one ends at whatever the caller already has on hand. */
  tc: (key: string, fallback: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}

/** Convenience for the common case — most call sites only need `t`. */
export function useTranslation(): I18nContextValue['t'] {
  return useI18n().t
}

// Base-English-only fallback for useTranslationSafe, module-scope (not a
// closure inside the hook) so the returned `t` has a stable identity
// across renders — same as any other hook return value a caller might drop
// into a dependency array. No app overrides, no locale: a component
// rendering with no I18nContext ancestor has no app in scope to resolve
// either from.
const FALLBACK_T: I18nContextValue['t'] = (key, vars) => {
  const raw = BASE_DICTIONARIES.en[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(vars[name] ?? ''))
}

/** Like useTranslation(), but safe to call with no I18nProvider ancestor —
 *  falls back to FALLBACK_T instead of throwing. Reads the context via
 *  useContext directly rather than useI18n(), since useI18n() is exactly
 *  the throw this exists to avoid. For components that can render before
 *  I18nProvider mounts, or never inside it at all — see runtime-router.tsx's
 *  runtimeCatchAllRoute and runtimeRouter's defaultNotFoundComponent, both
 *  of which fire under runtime-main.tsx's bare RouterProvider, before
 *  RuntimeAppRouteComponent (the thing that actually renders I18nProvider)
 *  ever mounts. */
export function useTranslationSafe(): I18nContextValue['t'] {
  return useContext(I18nContext)?.t ?? FALLBACK_T
}

function readStoredLocale(storageKey: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function resolveInitialLocale(supportedLocales: string[], defaultLocale: string, storageKey: string): string {
  const stored = readStoredLocale(storageKey)
  if (stored && supportedLocales.includes(stored)) return stored
  if (typeof navigator !== 'undefined') {
    const browserLocale = navigator.language?.slice(0, 2)
    if (browserLocale && supportedLocales.includes(browserLocale)) return browserLocale
  }
  return defaultLocale
}

interface I18nProviderProps {
  /** The published/draft app snapshot's per-app i18n overrides. Omitted in
   *  the builder's own admin entry (index.html) — most of its routes
   *  (client list, app list, login) have no single app in scope, so it gets
   *  base-dictionary-only translation; the runtime entry (runtime.html)
   *  always has one app in scope and passes its snapshot's `translations`
   *  here. Same two-layer split as ThemeProvider/mergeTheme, one layer
   *  earlier: theme has no meaningful "no app" state (a runtime always
   *  needs SOME theme), but a translation key always has a code-authored
   *  English default to fall back to, which is what makes the builder-entry
   *  case work at all. */
  overrides?: TranslationsConfig
  /** Storage is scoped so the builder's system language never changes the
   *  language preference of a published app runtime, and vice versa. */
  storageKey?: string
  children: ReactNode
}

// Hand-built context + lookup chain — no i18next, matching how ThemeProvider
// was done and this codebase's deliberately lean dependency list (see its
// own doc comment). Lookup order for t(key): app override for the current
// locale -> this build's base dictionary for the current locale -> base
// English -> the key itself. Locale resolution: explicit stored choice ->
// app default_locale -> browser language (if the app supports it) -> "en".
// Never blank, never throws.
export function I18nProvider({ overrides, storageKey = DEFAULT_LOCALE_STORAGE_KEY, children }: I18nProviderProps) {
  const supportedLocales = overrides?.supported_locales?.length ? overrides.supported_locales : BASE_LOCALES
  const defaultLocale = overrides?.default_locale && supportedLocales.includes(overrides.default_locale)
    ? overrides.default_locale
    : 'en'

  const [locale, setLocaleState] = useState<string>(() => {
    return resolveInitialLocale(supportedLocales, defaultLocale, storageKey)
  })

  // supportedLocales/defaultLocale can change under an already-mounted
  // provider (e.g. the runtime router re-resolving a different app's
  // snapshot) — re-clamp rather than leave `locale` pointing at a value the
  // new app no longer supports.
  const supportedKey = supportedLocales.join('|')
  useEffect(() => {
    setLocaleState((current) => (supportedLocales.includes(current) ? current : defaultLocale))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supportedKey is supportedLocales' stable identity for this effect
  }, [supportedKey, defaultLocale])

  const setLocale = (next: string) => {
    if (!supportedLocales.includes(next)) return
    setLocaleState(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // Private-browsing/storage-blocked contexts can throw — worst case
      // the choice just doesn't persist across loads.
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale
  }, [locale])

  const t = useMemo(() => {
    const appStrings = overrides?.strings ?? {}
    return (key: string, vars?: Record<string, string | number>) => {
      const raw = appStrings[locale]?.[key]
        ?? BASE_DICTIONARIES[locale]?.[key]
        ?? BASE_DICTIONARIES.en[key]
        ?? key
      if (!vars) return raw
      return raw.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(vars[name] ?? ''))
    }
  }, [overrides, locale])

  const tc = useMemo(() => {
    const appStrings = overrides?.strings ?? {}
    return (key: string, fallback: string) => appStrings[locale]?.[key] ?? fallback
  }, [overrides, locale])

  const value = useMemo(
    () => ({ locale, setLocale, supportedLocales, t, tc }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supportedKey stands in for supportedLocales' identity
    [locale, supportedKey, t, tc],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
