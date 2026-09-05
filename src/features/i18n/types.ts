// Canonical home for TranslationsConfig — mirrors features/theme/types.ts's
// ThemeConfig (features/applications imports this, not the reverse; see
// that file's own doc comment for why runtime-depended-on shapes live
// outside the builder-only CRUD feature).
//
// This is the per-app OVERRIDE layer only. A key absent from `strings` (or
// a locale absent from it entirely) falls back to the runtime's own bundled
// base dictionary — see dictionaries.ts — never to a blank string.
export interface TranslationsConfig {
  default_locale?: string
  /** Locales the runtime's language switcher offers end users. Render
   *  switchers from this list, not a hardcoded ['en', 'es'] — see
   *  I18nProvider's own doc comment. */
  supported_locales?: string[]
  /** Per-locale key/value overrides, e.g. { es: { 'common.save': 'Guardar' } }. */
  strings?: Record<string, Record<string, string>>
}
