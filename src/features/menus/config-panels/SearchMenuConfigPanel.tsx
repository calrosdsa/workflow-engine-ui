import { nanoid } from '@/features/workflows/builder/nanoid'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm } from '@/features/forms/hooks'
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
  const config = menu.config as SearchMenuConfig
  const { data: form } = useForm(config.form_id)

  const patch = (p: Partial<SearchMenuConfig>) => onChange({ ...config, ...p })

  const toggleColumn = (fieldName: string, checked: boolean) => {
    const columns = checked
      ? [...config.columns, fieldName]
      : config.columns.filter((c) => c !== fieldName)
    patch({ columns })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Target form</label>
        <FormReferenceSelect
          value={config.form_id}
          onChange={(formId) => patch({ form_id: formId ?? '', columns: [] })}
        />
      </div>

      {form && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Visible columns</label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {form.fields.map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-[12px] text-slate-700">
                <Checkbox
                  checked={config.columns.includes(f.name)}
                  onCheckedChange={(checked) => toggleColumn(f.name, checked === true)}
                />
                {f.label || f.name}
              </label>
            ))}
            {form.fields.length === 0 && (
              <p className="text-[11px] text-slate-400">This form has no data fields yet.</p>
            )}
          </div>
        </div>
      )}

      {form && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Default filter</label>
          <FilterBuilder
            group={ensureGroupIds(config.default_filter)}
            fields={form.fields}
            variables={[]}
            onChange={(g) => patch({ default_filter: g })}
          />
        </div>
      )}

      {form && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Default sort</label>
          <SortRuleList
            rules={ensureSortIds(config.default_sort)}
            fields={form.fields.map((f) => ({ name: f.name, label: f.label }))}
            onChange={(sort) => patch({ default_sort: sort })}
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Page size</label>
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
          <button
            type="button"
            onClick={() => removeRule(r.id)}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] text-slate-400 hover:text-red-500"
          >
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
