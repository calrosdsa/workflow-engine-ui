import { nanoid } from '@/features/workflows/builder/nanoid'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm } from '@/features/forms/hooks'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { TableWidgetConfig } from './schema'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

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
  const { data: form } = useForm(config.formId)

  const patch = (p: Partial<TableWidgetConfig>) => onChange({ ...config, ...p })

  const toggleColumn = (fieldName: string, checked: boolean) => {
    const columns = checked ? [...config.columns, fieldName] : config.columns.filter((c) => c !== fieldName)
    patch({ columns })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Form</Label>
        <FormReferenceSelect value={config.formId} onChange={(formId) => patch({ formId: formId ?? '', columns: [] })} />
      </div>

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-slate-600">Visible columns</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {form.fields.map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-[12px] text-slate-700">
                <Checkbox checked={config.columns.includes(f.name)} onCheckedChange={(checked) => toggleColumn(f.name, checked === true)} />
                {f.label || f.name}
              </label>
            ))}
            {form.fields.length === 0 && <p className="text-[11px] text-slate-400">This form has no data fields yet.</p>}
          </div>
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-slate-600">Default filter</Label>
          <FilterBuilder
            group={ensureGroupIds(config.defaultFilter)}
            fields={form.fields}
            variables={[]}
            onChange={(g) => patch({ defaultFilter: g })}
          />
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-slate-600">Default sort</Label>
          <SortRuleList
            rules={ensureSortIds(config.defaultSort)}
            fields={form.fields.map((f) => ({ name: f.name, label: f.label }))}
            onChange={(sort) => patch({ defaultSort: sort })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Rows per page</Label>
        <Input
          type="number"
          min={1}
          max={200}
          value={config.pageSize}
          onChange={(e) => patch({ pageSize: Number(e.target.value) || 10 })}
          className="h-8 w-24 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-[12px] text-slate-700">
        <Checkbox checked={config.allowUserFilter} onCheckedChange={(c) => patch({ allowUserFilter: c === true })} />
        Let viewers filter this table
      </label>

      <label className="flex items-center gap-2 text-[12px] text-slate-700">
        <Checkbox checked={config.rowClick === 'record'} onCheckedChange={(c) => patch({ rowClick: c === true ? 'record' : 'none' })} />
        Clicking a row opens its details
      </label>
    </div>
  )
}

function SortRuleList({ rules, fields, onChange }: {
  rules: SortRule[]
  fields: { name: string; label: string }[]
  onChange: (rules: SortRule[]) => void
}) {
  const addRule = () => onChange([...rules, { id: nanoid(), field: fields[0]?.name ?? '', dir: 'asc' }])
  const updateRule = (id: string, patch: Partial<SortRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRule = (id: string) => onChange(rules.filter((r) => r.id !== id))

  return (
    <div className="space-y-1.5">
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-1.5">
          <select
            value={r.field}
            onChange={(e) => updateRule(r.id, { field: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700"
          >
            {fields.map((f) => (
              <option key={f.name} value={f.name}>{f.label || f.name}</option>
            ))}
          </select>
          <select
            value={r.dir}
            onChange={(e) => updateRule(r.id, { dir: e.target.value as 'asc' | 'desc' })}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button type="button" onClick={() => removeRule(r.id)} className="shrink-0 rounded px-1.5 py-1 text-[11px] text-slate-400 hover:text-red-500">
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="w-full rounded-md border border-dashed border-slate-200 py-1 text-[11px] text-slate-500 hover:border-slate-300"
      >
        + Sort rule
      </button>
    </div>
  )
}
