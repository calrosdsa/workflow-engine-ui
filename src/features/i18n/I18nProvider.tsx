import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BASE_DICTIONARIES, BASE_LOCALES } from './dictionaries'
import type { TranslationsConfig } from './types'

const LOCALE_STORAGE_KEY = 'app-locale'

export interface I18nContextValue {
  locale: string
  setLocale: (locale: string) => void
  /** Render language switchers from this, never a hardcoded locale list —
   *  it's the app's own supported_locales when the runtime has overrides,
   *  falling back to this build's bundled dictionaries in the builder
   *  (which has no single app in scope; see I18nProvider's own comment). */
  supportedLocales: string[]
  t: (key: string, vars?: Record<string, string | number>) => string
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

function readStoredLocale(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

function resolveInitialLocale(supportedLocales: string[], defaultLocale: string): string {
  const stored = readStoredLocale()
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
  children: ReactNode
}

// Hand-built context + lookup chain — no i18next, matching how ThemeProvider
// was done and this codebase's deliberately lean dependency list (see its
// own doc comment). Lookup order for t(key): app override for the current
// locale -> this build's base dictionary for the current locale -> base
// English -> the key itself. Locale resolution: explicit stored choice ->
// app default_locale -> browser language (if the app supports it) -> "en".
// Never blank, never throws.
export function I18nProvider({ overrides, children }: I18nProviderProps) {
  const supportedLocales = overrides?.supported_locales?.length ? overrides.supported_locales : BASE_LOCALES
  const defaultLocale = overrides?.default_locale && supportedLocales.includes(overrides.default_locale)
    ? overrides.default_locale
    : 'en'

  const [locale, setLocaleState] = useState<string>(() => resolveInitialLocale(supportedLocales, defaultLocale))

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
    setLocaleState(next)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // Private-browsing/storage-blocked contexts can throw — worst case
      // the choice just doesn't persist across loads.
    }
  }

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

  const value = useMemo(
    () => ({ locale, setLocale, supportedLocales, t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supportedKey stands in for supportedLocales' identity
    [locale, supportedKey, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
