import { useEffect, useMemo, useState } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useApplicationTranslations, useUpdateApplicationTranslations } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { useForms } from '@/features/forms/hooks'
import { useMenus } from '@/features/menus/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { collectTranslatableFields, FIELD_CONTENT_KIND_LABELS } from '@/features/form-builder/localize-schema'
import type { CollectedField } from '@/features/form-builder/localize-schema'
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

/** One display name per group of CollectedField rows sharing a fieldPath —
 *  prefers that element's own `.label` entry, then `.form_name` (the form's
 *  own name row groups with nothing else, but still wants ITS OWN value as
 *  its heading rather than a raw fieldPath), then `.section_title` (a
 *  section groups its own title+description rows), then `.content` (a
 *  presentational heading/paragraph has none of those), then falls back to
 *  the raw key so a row is never unlabeled. */
function groupLabels(fields: CollectedField[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of fields) if (f.kind === 'label') map.set(f.fieldPath, f.defaultValue)
  for (const f of fields) if (!map.has(f.fieldPath) && f.kind === 'form_name') map.set(f.fieldPath, f.defaultValue)
  for (const f of fields) if (!map.has(f.fieldPath) && f.kind === 'section_title') map.set(f.fieldPath, f.defaultValue)
  for (const f of fields) if (!map.has(f.fieldPath) && f.kind === 'content') map.set(f.fieldPath, f.defaultValue)
  for (const f of fields) if (!map.has(f.fieldPath)) map.set(f.fieldPath, f.fieldPath.split('.').pop() ?? f.fieldPath)
  return map
}

type LocalizationTab = 'interface' | 'fields' | 'menus'

/** Management UI for this app's i18n string overrides — the "dynamic" half
 *  of translation support. Three genuinely different key sources share the
 *  same underlying strings map, shown as separate tabs rather than one
 *  merged grid since they have different editing semantics:
 *
 *  - Interface text: fixed, code-authored chrome (see
 *    features/i18n/dictionaries.ts). Its "default" column IS editable here
 *    — English has nowhere else to be re-worded.
 *  - Form fields: each form's own label/placeholder/help text/choice
 *    options/validation message/section titles, authored in the form
 *    builder. Its default column is READ-ONLY reference text — the form
 *    builder is the one place to edit it; this tab only adds OTHER-locale
 *    overrides on top.
 *  - Menus: each menu's own name, authored in the menu builder. Same
 *    read-only-default treatment as Form fields, for the same reason. */
export function LocalizationSection() {
  const { data: loaded, isLoading } = useApplicationTranslations()
  const updateMutation = useUpdateApplicationTranslations()
  const canWrite = usePermission('application:write')

  const [tab, setTab] = useState<LocalizationTab>('interface')
  const [draft, setDraft] = useState<Draft>(draftFrom(undefined))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (loaded) setDraft(draftFrom(loaded.translations))
  }, [loaded])

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

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

      <div className="mb-3 flex gap-1 border-b border-[hsl(var(--border))]">
        {([['interface', 'Interface text'], ['fields', 'Form fields'], ['menus', 'Menus']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
              tab === id
                ? 'border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'interface' && <InterfaceTextTable draft={draft} setCell={setCell} canWrite={canWrite} />}
        {tab === 'fields' && <FormFieldsTable draft={draft} setCell={setCell} canWrite={canWrite} />}
        {tab === 'menus' && <MenusTable draft={draft} setCell={setCell} canWrite={canWrite} />}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Languages size={13} />
        End users switch between these from the profile menu in the running app.
      </p>
    </div>
  )
}

interface TableProps {
  draft: Draft
  setCell: (locale: string, key: string, value: string) => void
  canWrite: boolean
}

/** Fixed, code-authored chrome — see features/i18n/dictionaries.ts's own
 *  doc comment. Rows come straight from the bundled base dictionary: there
 *  is no separate key registry, a string becomes editable here simply by
 *  being used via t() somewhere and added to en.ts. English is editable
 *  here too (unlike the Form fields tab) since it has nowhere else to be
 *  re-worded. */
function InterfaceTextTable({ draft, setCell, canWrite }: TableProps) {
  const keys = Object.keys(BASE_DICTIONARIES.en)
  return (
    <div className="h-full overflow-auto rounded-lg border border-[hsl(var(--border))]">
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
  )
}

/** Each form's own authored label/placeholder/help text/choice options/
 *  validation message — dynamic per-app content, distinct from Interface
 *  text above (see this file's own top comment). The default column is
 *  read-only reference text: this tab only adds OTHER-locale overrides,
 *  never re-edits what the designer typed — that happens in the form
 *  builder itself. */
function FormFieldsTable({ draft, setCell, canWrite }: TableProps) {
  const { data: forms, isLoading } = useForms()
  const [formId, setFormId] = useState<string | null>(null)

  const selected = forms?.find((f) => f.id === formId) ?? forms?.[0]

  const fields = useMemo(
    () => (selected ? collectTranslatableFields(resolveFormSchema(selected), selected.id, selected.name) : []),
    [selected],
  )
  const labels = useMemo(() => groupLabels(fields), [fields])
  // The Default column already shows the default locale's own authored
  // text — editing it happens in the form builder, not here (unlike
  // Interface text's English column) — so only OTHER locales get an
  // editable cell in this table.
  const otherLocales = draft.supported_locales.filter((l) => l !== draft.default_locale)

  if (isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (!forms || forms.length === 0) {
    return <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">This app has no forms yet.</p>
  }

  let lastFieldPath = ''

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <SelectMenu value={selected?.id ?? ''} onValueChange={setFormId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </SelectMenu>
      </div>

      {fields.length === 0 ? (
        <p className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          This form has no translatable text yet — every label, placeholder, and help text on it is empty.
        </p>
      ) : otherLocales.length === 0 ? (
        <p className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Add a second supported language above to translate this form's fields.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[hsl(var(--card))]">
              <tr>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">Field</th>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">Property</th>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">Default (as authored)</th>
                {otherLocales.map((locale) => (
                  <th key={locale} className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">
                    {LOCALE_LABELS[locale] ?? locale}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => {
                const showGroup = f.fieldPath !== lastFieldPath
                lastFieldPath = f.fieldPath
                return (
                  <tr key={f.key} className="border-b border-[hsl(var(--border))] last:border-b-0">
                    <td className="p-2 align-top font-medium text-[hsl(var(--foreground))]">
                      {showGroup ? labels.get(f.fieldPath) : ''}
                    </td>
                    <td className="p-2 align-top text-[hsl(var(--muted-foreground))]">
                      {FIELD_CONTENT_KIND_LABELS[f.kind]}{f.kind === 'option' ? ` "${f.optionValue}"` : ''}
                    </td>
                    <td className="p-2 align-top italic text-[hsl(var(--muted-foreground))]">{f.defaultValue}</td>
                    {otherLocales.map((locale) => (
                      <td key={locale} className="p-2 align-top">
                        <Input
                          value={draft.strings[locale]?.[f.key] ?? ''}
                          onChange={(e) => setCell(locale, f.key, e.target.value)}
                          placeholder={f.defaultValue}
                          disabled={!canWrite}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Each menu's own name, authored in the menu builder — see this file's top
 *  comment for why the default column is read-only here too. A flat list,
 *  unlike Form fields: menus have no per-form scoping to pick between, and
 *  no nested structure worth grouping (see localize-menus.ts's own key
 *  scheme, one key per menu). */
function MenusTable({ draft, setCell, canWrite }: TableProps) {
  const { data: menus, isLoading } = useMenus()
  const otherLocales = draft.supported_locales.filter((l) => l !== draft.default_locale)

  if (isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (!menus || menus.length === 0) {
    return <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">This app has no menus yet.</p>
  }
  if (otherLocales.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Add a second supported language above to translate menu names.
      </p>
    )
  }

  return (
    <div className="h-full overflow-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-[hsl(var(--card))]">
          <tr>
            <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">Menu (as authored)</th>
            {otherLocales.map((locale) => (
              <th key={locale} className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">
                {LOCALE_LABELS[locale] ?? locale}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {menus.map((m) => {
            const key = `menu.${m.id}.name`
            return (
              <tr key={m.id} className="border-b border-[hsl(var(--border))] last:border-b-0">
                <td className="p-2 align-top italic text-[hsl(var(--muted-foreground))]">{m.name}</td>
                {otherLocales.map((locale) => (
                  <td key={locale} className="p-2 align-top">
                    <Input
                      value={draft.strings[locale]?.[key] ?? ''}
                      onChange={(e) => setCell(locale, key, e.target.value)}
                      placeholder={m.name}
                      disabled={!canWrite}
                    />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
