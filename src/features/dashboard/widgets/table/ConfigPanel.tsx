import { nanoid } from '@/features/workflows/builder/nanoid'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { useCurrentUserAttrs } from '@/features/workflows/builder/useCurrentUserAttrs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForm } from '@/features/forms/hooks'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { TableWidgetConfig, TableFooterAggregate } from './schema'
import type { AggregateFn } from '@/features/forms/api'
import type { FieldType } from '@/features/forms/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

// Mirrors the chart widget's own numericTypes gate (ConfigPanel.tsx) so
// this UI never lets an author configure a footer aggregate the backend
// would reject as non-numeric.
const NUMERIC_TYPES: FieldType[] = ['integer', 'decimal']

// Reuses the same common.fn_* words chart/ConfigPanel.tsx's own fnLabels
// draws from — one owner for "Count"/"Sum"/etc. across both widget types.
function fnLabels(t: I18nContextValue['t']): Record<AggregateFn, string> {
  return {
    count: t('common.fn_count'),
    sum: t('common.fn_sum'),
    avg: t('common.fn_avg'),
    min: t('common.fn_min'),
    max: t('common.fn_max'),
    count_distinct: t('common.fn_count_distinct'),
    median: t('common.fn_median'),
  }
}

// Same field set as features/menus/config-panels/SearchMenuConfigPanel.tsx
// (form picker, column checkboxes, default filter, default sort, page
// size), plus two dashboard-tile-specific toggles (allowUserFilter,
// rowClick) that a full Search page doesn't need since it always shows
// filtering and always opens the record drawer. ensureGroupIds/ensureSortIds
// are duplicated from SearchMenuConfigPanel.tsx rather than shared — that
// file already documents the same call made against NodeConfigPanel.tsx's
// identical helper, for the same reason: both call sites are small and the
// features have no other coupling.
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

export function TableConfigPanel({ config, onChange }: WidgetConfigPanelProps<TableWidgetConfig>) {
  const t = useTranslation()
  const { data: form } = useForm(config.formId)
  const referenceFields = (form?.fields ?? []).filter((f) => f.type === 'reference')
  const viewerModes = useCurrentUserAttrs()

  const patch = (p: Partial<TableWidgetConfig>) => onChange({ ...config, ...p })

  const toggleColumn = (fieldName: string, checked: boolean) => {
    const columns = checked ? [...config.columns, fieldName] : config.columns.filter((c) => c !== fieldName)
    patch({ columns })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.form')}</Label>
        <FormReferenceSelect value={config.formId} onChange={(formId) => patch({ formId: formId ?? '', columns: [] })} />
      </div>

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.visible_columns')}</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[hsl(var(--border))] p-2">
            {form.fields.map((f) => (
              <Label key={f.name} className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
                <Checkbox checked={config.columns.includes(f.name)} onCheckedChange={(checked) => toggleColumn(f.name, checked === true)} />
                {f.label || f.name}
              </Label>
            ))}
            {form.fields.length === 0 && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.no_fields')}</p>}
          </div>
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.default_filter')}</Label>
          <FilterBuilder
            group={ensureGroupIds(config.defaultFilter)}
            fields={form.fields}
            variables={[]}
            viewerModes={viewerModes}
            allowRelativeDates
            onChange={(g) => patch({ defaultFilter: g })}
          />
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.default_sort')}</Label>
          <SortRuleList
            rules={ensureSortIds(config.defaultSort)}
            fields={form.fields.map((f) => ({ name: f.name, label: f.label }))}
            onChange={(sort) => patch({ defaultSort: sort })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.rows_per_page')}</Label>
        <Input
          type="number"
          min={1}
          max={200}
          value={config.pageSize}
          onChange={(e) => patch({ pageSize: Number(e.target.value) || 10 })}
          className="h-8 w-24 text-sm"
        />
      </div>

      <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
        <Checkbox checked={config.allowUserFilter} onCheckedChange={(c) => patch({ allowUserFilter: c === true })} />
        {t('builder.dashboard_table.allow_filter')}
      </Label>

      <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
        <Checkbox checked={config.rowClick === 'record'} onCheckedChange={(c) => patch({ rowClick: c === true ? 'record' : 'none' })} />
        {t('builder.dashboard_table.row_click')}
      </Label>

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.footer_totals')}</Label>
          <FooterAggregatesList
            aggregates={config.footerAggregates ?? []}
            fields={form.fields}
            numericFields={form.fields.filter((f) => NUMERIC_TYPES.includes(f.type))}
            onChange={(footerAggregates) => patch({ footerAggregates: footerAggregates.length > 0 ? footerAggregates : undefined })}
          />
        </div>
      )}

      {form && (
        <div className="space-y-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.record_scoping')}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t('builder.dashboard_table.record_scoping_hint')}
          </p>
          {referenceFields.length === 0 ? (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.no_reference_fields')}</p>
          ) : (
            <SelectMenu
              value={config.scopeToRecord?.fieldName ?? '__none__'}
              onValueChange={(v) => patch({ scopeToRecord: v === '__none__' ? undefined : { fieldName: v } })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('builder.dashboard_table.not_scoped')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">{t('builder.dashboard_table.not_scoped')}</SelectItem>
                {referenceFields.map((f) => (
                  <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
          )}
        </div>
      )}
    </div>
  )
}

function FooterAggregatesList({ aggregates, fields, numericFields, onChange }: {
  aggregates: TableFooterAggregate[]
  /** Every column — what count_distinct may total over. */
  fields: { name: string; label: string }[]
  numericFields: { name: string; label: string }[]
  onChange: (aggregates: TableFooterAggregate[]) => void
}) {
  const t = useTranslation()
  const labels = fnLabels(t)
  // A footer can now total a non-numeric column, but only one way: by
  // counting its distinct values. Everything else still needs a number, so
  // the per-row field list follows the row's own measure.
  const eligible = (fn: AggregateFn) => (fn === 'count_distinct' ? fields : numericFields)
  const addAggregate = () => {
    // Seeded as a sum when there is a number to sum, else as the one measure
    // a text column supports — rather than refusing to add anything, which
    // is what this did when the whole feature was numeric-only.
    if (numericFields.length > 0) {
      onChange([...aggregates, { field: numericFields[0].name, fn: 'sum' }])
    } else if (fields.length > 0) {
      onChange([...aggregates, { field: fields[0].name, fn: 'count_distinct' }])
    }
  }
  const updateAggregate = (i: number, patch: Partial<TableFooterAggregate>) =>
    onChange(aggregates.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))
  const removeAggregate = (i: number) => onChange(aggregates.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-1.5">
      {aggregates.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <SelectMenu value={a.fn} onValueChange={(v) => updateAggregate(i, { fn: v as AggregateFn })}>
            <SelectTrigger className="h-7 w-24 shrink-0 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(labels) as AggregateFn[]).map((fn) => (
                <SelectItem key={fn} value={fn} className="text-xs">{labels[fn]}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>
          <SelectMenu value={a.field} onValueChange={(v) => updateAggregate(i, { field: v })}>
            <SelectTrigger className="h-7 min-w-0 flex-1 text-[11px]"><SelectValue placeholder={t('builder.dashboard_table.field_placeholder')} /></SelectTrigger>
            <SelectContent>
              {eligible(a.fn).map((f) => (
                <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
              ))}
              {eligible(a.fn).length === 0 && <SelectItem value="__none__" disabled className="text-xs">{t('builder.dashboard_table.no_numeric_fields')}</SelectItem>}
            </SelectContent>
          </SelectMenu>
          <button type="button" onClick={() => removeAggregate(i)} className="shrink-0 rounded px-1.5 py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]">
            ✕
          </button>
        </div>
      ))}
      {fields.length === 0 ? (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_table.no_numeric_to_total')}</p>
      ) : (
        <button
          type="button"
          onClick={addAggregate}
          className="w-full rounded-md border border-dashed border-[hsl(var(--border))] py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground))]/40"
        >
          + {t('builder.dashboard_table.add_footer_total')}
        </button>
      )}
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
          <button type="button" onClick={() => removeRule(r.id)} className="shrink-0 rounded px-1.5 py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]">
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="w-full rounded-md border border-dashed border-[hsl(var(--border))] py-1 text-[11px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground))]/40"
      >
        + {t('builder.dashboard_table.add_sort_rule')}
      </button>
    </div>
  )
}
