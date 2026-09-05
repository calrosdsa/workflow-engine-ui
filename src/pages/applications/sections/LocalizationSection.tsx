import { useEffect, useState } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useApplicationTranslations, useUpdateApplicationTranslations } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { BASE_DICTIONARIES, BASE_LOCALES, LOCALE_LABELS } from '@/features/i18n/dictionaries'
import type { TranslationsConfig } from '@/features/applications/types'

interface Draft {
  default_locale: string
  supported_locales: string[]
  strings: Record<string, Record<string, string>>
}

function draftFrom(loaded: TranslationsConfig | undefined): Draft {
  const supported = loaded?.supported_locales?.length ? loaded.supported_locales : BASE_LOCALES
  return {
    default_locale: loaded?.default_locale && supported.includes(loaded.default_locale) ? loaded.default_locale : 'en',
    supported_locales: supported,
    strings: loaded?.strings ?? {},
  }
}

/** Management UI for this app's i18n string overrides — the "dynamic" half
 *  of translation support (the other half, the bundled base dictionary a
 *  key falls back to when unset here, lives in code — see
 *  features/i18n/dictionaries.ts's own doc comment). Rows come from that
 *  same base dictionary: there is no separate key registry, a string
 *  becomes editable here simply by being used via t() somewhere and added
 *  to en.ts. Only what a designer actually types is persisted — an
 *  untouched cell keeps using the bundled default shown as its placeholder. */
export function LocalizationSection() {
  const { data: loaded, isLoading } = useApplicationTranslations()
  const updateMutation = useUpdateApplicationTranslations()
  const canWrite = usePermission('application:write')

  const [draft, setDraft] = useState<Draft>(draftFrom(undefined))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (loaded) setDraft(draftFrom(loaded.translations))
  }, [loaded])

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const keys = Object.keys(BASE_DICTIONARIES.en)

  const toggleLocale = (locale: string, on: boolean) => {
    setSaved(false)
    setDraft((d) => {
      const supported_locales = on
        ? [...d.supported_locales, locale]
        : d.supported_locales.filter((l) => l !== locale)
      const default_locale = supported_locales.includes(d.default_locale) ? d.default_locale : (supported_locales[0] ?? 'en')
      return { ...d, supported_locales, default_locale }
    })
  }

  const setCell = (locale: string, key: string, value: string) => {
    setSaved(false)
    setDraft((d) => ({
      ...d,
      strings: { ...d.strings, [locale]: { ...d.strings[locale], [key]: value } },
    }))
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync({ translations: draft })
    setSaved(true)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Localization</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Languages this app's runtime offers end users, and any wording overrides for them.
            A cell left blank keeps using the runtime's built-in default shown as its placeholder.
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save translations
            </Button>
            {saved && !updateMutation.isPending && <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]"><CheckCircle2 size={13} />Saved</span>}
            {updateMutation.isError && <span className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />Failed to save</span>}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6 rounded-lg border border-[hsl(var(--border))] p-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Supported languages</p>
          <div className="flex flex-wrap gap-4">
            {BASE_LOCALES.map((locale) => (
              <label key={locale} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={draft.supported_locales.includes(locale)}
                  onCheckedChange={(v) => toggleLocale(locale, v === true)}
                  disabled={!canWrite}
                />
                {LOCALE_LABELS[locale] ?? locale}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Default language</p>
          <SelectMenu
            value={draft.default_locale}
            onValueChange={(v) => { setSaved(false); setDraft((d) => ({ ...d, default_locale: v })) }}
            disabled={!canWrite}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {draft.supported_locales.map((l) => <SelectItem key={l} value={l}>{LOCALE_LABELS[l] ?? l}</SelectItem>)}
            </SelectContent>
          </SelectMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-[hsl(var(--card))]">
            <tr>
              <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">Key</th>
              {draft.supported_locales.map((locale) => (
                <th key={locale} className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  {LOCALE_LABELS[locale] ?? locale}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={draft.supported_locales.length + 1} className="p-4 text-center text-[hsl(var(--muted-foreground))]">
                  No translatable strings yet — nothing in the runtime uses t() yet.
                </td>
              </tr>
            )}
            {keys.map((key) => (
              <tr key={key} className="border-b border-[hsl(var(--border))] last:border-b-0">
                <td className="p-2 align-top font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {key}
                  <div className="mt-0.5 font-sans text-[11px] italic text-[hsl(var(--muted-foreground))]/70">{BASE_DICTIONARIES.en[key]}</div>
                </td>
                {draft.supported_locales.map((locale) => (
                  <td key={locale} className="p-2 align-top">
                    <Input
                      value={draft.strings[locale]?.[key] ?? ''}
                      onChange={(e) => setCell(locale, key, e.target.value)}
                      placeholder={BASE_DICTIONARIES[locale]?.[key] ?? BASE_DICTIONARIES.en[key]}
                      disabled={!canWrite}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Languages size={13} />
        End users switch between these from the profile menu in the running app.
      </p>
    </div>
  )
}
