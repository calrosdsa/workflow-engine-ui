import { nanoid } from '@/features/workflows/builder/nanoid'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { useCurrentUserAttrs } from '@/features/workflows/builder/useCurrentUserAttrs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForm } from '@/features/forms/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { ColumnsPicker } from '../saved-views/ColumnsPicker'
import type { Menu, SearchMenuConfig, FilterGroup, SortRule } from '../types'

interface SearchMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

// Re-attach UI-only `id` keys to a filter tree loaded from the backend
// (which stores the stripped, id-less shape) — mirrors the identical
// ensureGroupIds helper in features/workflows/builder/NodeConfigPanel.tsx,
// duplicated locally rather than shared since both call sites are small and
// the two features have no other coupling.
function ensureGroupIds(g: FilterGroup | undefined): FilterGroup {
  if (!g) return newGroup()
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map((c) => ({ ...c, id: c.id ?? nanoid() })),
    groups: (g.groups ?? []).map((sub) => ensureGroupIds(sub)),
  }
}

function ensureSortIds(sort: SortRule[] | undefined): SortRule[] {
  return (sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() }))
}

export function SearchMenuConfigPanel({ menu, onChange }: SearchMenuConfigPanelProps) {
  const t = useTranslation()
  const config = menu.config as SearchMenuConfig
  const { data: form } = useForm(config.form_id)
  const viewerModes = useCurrentUserAttrs()

  const patch = (p: Partial<SearchMenuConfig>) => onChange({ ...config, ...p })


  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.target_form_label')}</Label>
        <FormReferenceSelect
          value={config.form_id}
          onChange={(formId) => patch({ form_id: formId ?? '', columns: [] })}
        />
      </div>

      {form && (
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('common.columns')}</Label>
          {form.fields.length === 0 ? (
            <p className="rounded-md border border-[hsl(var(--border))] p-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              {t('menus.config_panels.search.columns_no_fields')}
            </p>
          ) : (
            <>
              {/* ColumnsPicker, not a local checkbox list. It already does
                  exactly this job for saved views at runtime — drag to
                  reorder, eye to show/hide — and its own contract is written
                  against SearchMenuConfig.columns' convention, so it drops in
                  unchanged. Reusing it also fixes a real mismatch the
                  checkbox list had: RecordsTable treats an EMPTY columns list
                  as "show every field" (visibleColumns' fallback), while the
                  checkboxes rendered it as "nothing selected" — so a menu
                  that had never had its columns touched showed zero ticks in
                  the builder and every column at runtime. ColumnsPicker
                  resolves empty to the explicit full list, so what you see
                  here is what the runtime renders. */}
              <ColumnsPicker
                fields={form.fields}
                columns={config.columns}
                onChange={(columns) => patch({ columns })}
              />
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                {t('menus.config_panels.search.columns_hint')}
              </p>
            </>
          )}
        </div>
      )}

      {form && (
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.search.default_filter_label')}</Label>
          <p className="mb-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('menus.config_panels.search.default_filter_hint')}
          </p>
          <FilterBuilder
            group={ensureGroupIds(config.default_filter)}
            fields={form.fields}
            variables={[]}
            viewerModes={viewerModes}
            onChange={(g) => patch({ default_filter: g })}
          />
        </div>
      )}

      {form && (
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.search.default_sort_label')}</Label>
          <SortRuleList
            rules={ensureSortIds(config.default_sort)}
            fields={form.fields.map((f) => ({ name: f.name, label: f.label }))}
            onChange={(sort) => patch({ default_sort: sort })}
          />
        </div>
      )}

      <div>
        <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('menus.config_panels.search.page_size_label')}</Label>
        <Input
          type="number"
          min={1}
          max={200}
          value={config.page_size}
          onChange={(e) => patch({ page_size: Number(e.target.value) || 25 })}
          className="w-24"
        />
      </div>
    </div>
  )
}

function SortRuleList({ rules, fields, onChange }: {
  rules: SortRule[]
  fields: { name: string; label: string }[]
  onChange: (rules: SortRule[]) => void
}) {
  const t = useTranslation()
  const addRule = () => onChange([...rules, { id: nanoid(), field: fields[0]?.name ?? '', dir: 'asc' }])
  const updateRule = (id: string, patch: Partial<SortRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRule = (id: string) => onChange(rules.filter((r) => r.id !== id))

  return (
    <div className="space-y-1.5">
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-1.5">
          <SelectMenu value={r.field} onValueChange={(v) => updateRule(r.id, { field: v })}>
            <SelectTrigger className="h-7 min-w-0 flex-1 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>
          <SelectMenu value={r.dir} onValueChange={(v) => updateRule(r.id, { dir: v as 'asc' | 'desc' })}>
            <SelectTrigger className="h-7 w-32 shrink-0 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asc" className="text-xs">{t('common.asc')}</SelectItem>
              <SelectItem value="desc" className="text-xs">{t('common.desc')}</SelectItem>
            </SelectContent>
          </SelectMenu>
          <button
            type="button"
            onClick={() => removeRule(r.id)}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="w-full rounded-md border border-dashed border-[hsl(var(--border))] py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground))]/40"
      >
        + {t('menus.config_panels.search.add_sort_rule')}
      </button>
    </div>
  )
}
