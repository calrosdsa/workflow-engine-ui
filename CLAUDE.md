# workflow-engine-ui conventions

## i18n

This app has translation infrastructure (`src/features/i18n/`): `I18nProvider`
+ `useTranslation()`/`useI18n()`, a bundled base English/Spanish dictionary
(`locales/en.ts`/`es.ts`), and a per-app override layer editable in the
design app (App Design → Localization) and via the `get_translations`/
`update_translations` MCP tools.

**Every new page or component must pull its user-facing strings through
`t('some.key')` instead of a literal string** — never hardcode English text
in JSX. Add the key (with its English value) to `src/features/i18n/locales/
en.ts` when you introduce it; a Spanish value in `es.ts` is welcome but not
required (an absent key falls back to English — see I18nProvider's own doc
comment). Existing pages have not been migrated yet ("page per page" is an
ongoing, separate effort) — this rule governs code written from here on,
not a mandate to sweep the codebase.
