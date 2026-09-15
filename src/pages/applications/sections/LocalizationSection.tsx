import { useEffect, useMemo, useState } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, Languages, Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useApplicationTranslations, useUpdateApplicationTranslations } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { useForms } from '@/features/forms/hooks'
import { useMenus } from '@/features/menus/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { collectTranslatableFields, FIELD_CONTENT_KIND_LABELS } from '@/features/form-builder/localize-schema'
import type { CollectedField } from '@/features/form-builder/localize-schema'
import { BASE_DICTIONARIES, BASE_LOCALES, LOCALE_LABELS } from '@/features/i18n/dictionaries'
import type { TranslationsConfig } from '@/features/applications/types'
import { useTranslation } from '@/features/i18n/I18nProvider'

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

interface LanguageMultiSelectProps {
  value: string[]
  onChange: (locales: string[]) => void
  disabled?: boolean
}

/** Supported-languages picker — a searchable multi-select combobox with
 *  removable chips, the same Popover+Command pattern RoleMultiSelect/
 *  UserMultiSelect already use elsewhere in this codebase (see
 *  features/form-builder/config/RoleMultiSelect.tsx). A row of checkboxes
 *  (the previous implementation here) reads fine for two or three
 *  languages and stops fitting the row entirely somewhere past that; this
 *  scales to however many locales a future build ever ships, since the
 *  trigger always renders as one fixed-width "N selected" control and the
 *  chips below it wrap instead of widening the row. */
function LanguageMultiSelect({ value, onChange, disabled }: LanguageMultiSelectProps) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const toggle = (locale: string) => {
    onChange(value.includes(locale) ? value.filter((l) => l !== locale) : [...value, locale])
  }
  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('h-8 w-56 justify-between gap-2 px-2.5 text-[13px] font-normal', value.length === 0 && 'text-[hsl(var(--muted-foreground))]')}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Languages size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">
                {value.length === 0 ? t('localization.select_languages') : t('localization.selected_languages', { count: value.length })}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder={t('localization.search_languages')} />
            <CommandList>
              <CommandEmpty>{t('localization.no_languages')}</CommandEmpty>
              <CommandGroup>
                {BASE_LOCALES.map((locale) => {
                  const isSelected = value.includes(locale)
                  return (
                    <CommandItem key={locale} value={LOCALE_LABELS[locale] ?? locale} onSelect={() => toggle(locale)}>
                      <Check size={14} className={cn('shrink-0', isSelected ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                      <span className="truncate">{LOCALE_LABELS[locale] ?? locale}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex max-w-md flex-wrap gap-1.5">
          {value.map((locale) => (
            <span
              key={locale}
              className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-1 pl-2 pr-1 text-[11px] text-[hsl(var(--muted-foreground))]"
            >
              {LOCALE_LABELS[locale] ?? locale}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(locale)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                  title={t('common.remove')}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

type LocalizationTab = 'interface' | 'fields' | 'menus'

const TABS: { id: LocalizationTab; labelKey: string }[] = [
  { id: 'interface', labelKey: 'localization.interface_text' },
  { id: 'fields', labelKey: 'localization.form_fields' },
  { id: 'menus', labelKey: 'localization.menus' },
]

/** Management UI for this app's i18n string overrides — the "dynamic" half
 *  of translation support. Three genuinely different key sources share the
 *  same underlying strings map, shown as separate tabs rather than one
 *  merged grid since they have different editing semantics:
 *
 *  - Interface text: fixed, code-authored chrome (see
 *    features/i18n/dictionaries.ts). Its English column IS editable here
 *    — English has nowhere else to be re-worded.
 *  - Form fields: each form's own label/placeholder/help text/choice
 *    options/validation message/section titles, authored in the form
 *    builder. Its default column is READ-ONLY reference text — the form
 *    builder is the one place to edit it; this tab only adds OTHER-locale
 *    overrides on top.
 *  - Menus: each menu's own name, authored in the menu builder. Same
 *    read-only-default treatment as Form fields, for the same reason.
 *
 *  Every table shows at most two editable/reference VALUE columns — the
 *  fixed one (English, or the read-only "as authored" text) plus whichever
 *  ONE other language the "Translating into" picker below currently has
 *  selected — never one column per supported locale. A supported-languages
 *  list that keeps growing (this started as a checkbox row, then a 3-column
 *  table, both of which stop fitting the screen past a handful of
 *  languages) no longer changes how wide anything here gets; only the
 *  picker's own option list grows. */
export function LocalizationSection() {
  const t = useTranslation()
  const { data: loaded, isLoading } = useApplicationTranslations()
  const updateMutation = useUpdateApplicationTranslations()
  const canWrite = usePermission('application:write')

  const [tab, setTab] = useState<LocalizationTab>('interface')
  const [draft, setDraft] = useState<Draft>(draftFrom(undefined))
  const [saved, setSaved] = useState(false)

  // Every language besides the default is a candidate to translate INTO —
  // the default is the one language always shown as a fixed reference
  // column instead (English for Interface text, "as authored" for Form
  // fields/Menus), so translating "into" it would just duplicate that
  // column.
  const otherLocales = draft.supported_locales.filter((l) => l !== draft.default_locale)
  const otherLocalesKey = otherLocales.join('|')
  const [targetLocale, setTargetLocale] = useState<string | null>(otherLocales[0] ?? null)

  useEffect(() => {
    if (loaded) setDraft(draftFrom(loaded.translations))
  }, [loaded])

  // Keeps targetLocale valid as supported_locales/default_locale change
  // (a language added/removed, or the default itself switched) — same
  // "reset to the first still-valid option" reasoning I18nProvider's own
  // locale-clamping effect uses.
  useEffect(() => {
    setTargetLocale((current) => (current && otherLocales.includes(current) ? current : (otherLocales[0] ?? null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- otherLocalesKey stands in for otherLocales' identity
  }, [otherLocalesKey])

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const setSupportedLocales = (locales: string[]) => {
    if (locales.length === 0) return // always keep at least one supported language
    setSaved(false)
    setDraft((d) => {
      const default_locale = locales.includes(d.default_locale) ? d.default_locale : (locales[0] ?? 'en')
      return { ...d, supported_locales: locales, default_locale }
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
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('app_design.localization')}</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t('localization.description')}
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('localization.save')}
            </Button>
            {saved && !updateMutation.isPending && <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]"><CheckCircle2 size={13} />{t('common.saved')}</span>}
            {updateMutation.isError && <span className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />{t('localization.save_failed')}</span>}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-start gap-6 rounded-lg border border-[hsl(var(--border))] p-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('localization.supported_languages')}</p>
          <LanguageMultiSelect value={draft.supported_locales} onChange={setSupportedLocales} disabled={!canWrite} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('localization.default_language')}</p>
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
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('localization.translating_into')}</p>
          {otherLocales.length === 0 ? (
            <p className="flex h-8 items-center text-[13px] text-[hsl(var(--muted-foreground))]">{t('localization.add_another_language')}</p>
          ) : (
            <SelectMenu value={targetLocale ?? ''} onValueChange={setTargetLocale}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {otherLocales.map((l) => <SelectItem key={l} value={l}>{LOCALE_LABELS[l] ?? l}</SelectItem>)}
              </SelectContent>
            </SelectMenu>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map(({ id, labelKey }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
              tab === id
                ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'interface' && <InterfaceTextTable draft={draft} setCell={setCell} canWrite={canWrite} targetLocale={targetLocale} />}
        {tab === 'fields' && <FormFieldsTable draft={draft} setCell={setCell} canWrite={canWrite} targetLocale={targetLocale} />}
        {tab === 'menus' && <MenusTable draft={draft} setCell={setCell} canWrite={canWrite} targetLocale={targetLocale} />}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Languages size={13} />
        {t('localization.end_user_hint')}
      </p>
    </div>
  )
}

interface TableProps {
  draft: Draft
  setCell: (locale: string, key: string, value: string) => void
  canWrite: boolean
  /** The one non-default language currently being translated into, from
   *  the "Translating into" picker above — null only when the app supports
   *  a single language and there is nothing else to translate. Every table
   *  renders at most this one extra editable column, never one per
   *  supported locale. */
  targetLocale: string | null
}

/** Fixed, code-authored chrome — see features/i18n/dictionaries.ts's own
 *  doc comment. Rows come straight from the bundled base dictionary: there
 *  is no separate key registry, a string becomes editable here simply by
 *  being used via t() somewhere and added to en.ts. English is editable
 *  here too (unlike the other two tabs' default column) since it has
 *  nowhere else to be re-worded. */
function InterfaceTextTable({ draft, setCell, canWrite, targetLocale }: TableProps) {
  const t = useTranslation()
  const keys = Object.keys(BASE_DICTIONARIES.en)
  return (
    <div className="h-full overflow-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-[hsl(var(--card))]">
          <tr>
            <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">{t('localization.key')}</th>
            <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">{t('localization.english')}</th>
            {targetLocale && (
              <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">
                {LOCALE_LABELS[targetLocale] ?? targetLocale}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-b border-[hsl(var(--border))] last:border-b-0">
              <td className="p-2 align-top font-mono text-xs text-[hsl(var(--muted-foreground))]">{key}</td>
              <td className="p-2 align-top">
                <Input
                  value={draft.strings.en?.[key] ?? ''}
                  onChange={(e) => setCell('en', key, e.target.value)}
                  placeholder={BASE_DICTIONARIES.en[key]}
                  disabled={!canWrite}
                />
              </td>
              {targetLocale && (
                <td className="p-2 align-top">
                  <Input
                    value={draft.strings[targetLocale]?.[key] ?? ''}
                    onChange={(e) => setCell(targetLocale, key, e.target.value)}
                    placeholder={BASE_DICTIONARIES[targetLocale]?.[key] ?? BASE_DICTIONARIES.en[key]}
                    disabled={!canWrite}
                  />
                </td>
              )}
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
 *  read-only reference text: this tab only adds an override for whichever
 *  language is currently selected in "Translating into," never re-edits
 *  what the designer typed — that happens in the form builder itself. */
function FormFieldsTable({ draft, setCell, canWrite, targetLocale }: TableProps) {
  const t = useTranslation()
  const { data: forms, isLoading } = useForms()
  const [formId, setFormId] = useState<string | null>(null)

  const selected = forms?.find((f) => f.id === formId) ?? forms?.[0]

  const fields = useMemo(
    () => (selected ? collectTranslatableFields(resolveFormSchema(selected), selected.id, selected.name) : []),
    [selected],
  )
  const labels = useMemo(() => groupLabels(fields), [fields])

  if (isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (!forms || forms.length === 0) {
    return <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">{t('localization.no_forms')}</p>
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
          {t('localization.no_translatable_form_text')}
        </p>
      ) : !targetLocale ? (
        <p className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {t('localization.add_second_language_form')}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-[hsl(var(--card))]">
              <tr>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">{t('common.fields')}</th>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">{t('localization.property')}</th>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">{t('localization.default_authored')}</th>
                <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">
                  {LOCALE_LABELS[targetLocale] ?? targetLocale}
                </th>
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
                    <td className="p-2 align-top">
                      <Input
                        value={draft.strings[targetLocale]?.[f.key] ?? ''}
                        onChange={(e) => setCell(targetLocale, f.key, e.target.value)}
                        placeholder={f.defaultValue}
                        disabled={!canWrite}
                      />
                    </td>
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
function MenusTable({ draft, setCell, canWrite, targetLocale }: TableProps) {
  const t = useTranslation()
  const { data: menus, isLoading } = useMenus()

  if (isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (!menus || menus.length === 0) {
    return <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">{t('localization.no_menus')}</p>
  }
  if (!targetLocale) {
    return (
      <p className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {t('localization.add_second_language_menus')}
      </p>
    )
  }

  return (
    <div className="h-full overflow-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-[hsl(var(--card))]">
          <tr>
            <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">{t('localization.menu_authored')}</th>
            <th className="border-b border-[hsl(var(--border))] p-2 text-left font-medium text-[hsl(var(--muted-foreground))]">
              {LOCALE_LABELS[targetLocale] ?? targetLocale}
            </th>
          </tr>
        </thead>
        <tbody>
          {menus.map((m) => {
            const key = `menu.${m.id}.name`
            return (
              <tr key={m.id} className="border-b border-[hsl(var(--border))] last:border-b-0">
                <td className="p-2 align-top italic text-[hsl(var(--muted-foreground))]">{m.name}</td>
                <td className="p-2 align-top">
                  <Input
                    value={draft.strings[targetLocale]?.[key] ?? ''}
                    onChange={(e) => setCell(targetLocale, key, e.target.value)}
                    placeholder={m.name}
                    disabled={!canWrite}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
