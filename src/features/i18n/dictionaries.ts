import { en } from './locales/en'
import { es } from './locales/es'

// The set of locales this build ships a bundled dictionary for. Distinct
// from an app's own `supported_locales` (features/i18n/types.ts) — that list
// drives what the runtime's language switcher OFFERS; this one is just
// "which of those, if any, we have a code-authored fallback for." An app is
// free to declare a supported locale with no entry here (falls straight
// through to its own overrides, then to English).
export const BASE_DICTIONARIES: Record<string, Record<string, string>> = { en, es }

export const BASE_LOCALES = Object.keys(BASE_DICTIONARIES)

// Human-readable names for the locale switcher / management UI. Every
// BASE_LOCALES entry should have one; an app-declared supported_locale this
// build has no dictionary (and therefore no label) for just shows its raw
// code instead — see call sites' `?? locale` fallback.
export const LOCALE_LABELS: Record<string, string> = { en: 'English', es: 'Español' }
