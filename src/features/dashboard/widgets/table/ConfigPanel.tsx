import { nanoid } from '@/features/workflows/builder/nanoid'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
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
  const referenceFields = (form?.fields ?? []).filter((f) => f.type === 'reference')

  const patch = (p: Partial<TableWidgetConfig>) => onChange({ ...config, ...p })

  const toggleColumn = (fieldName: string, checked: boolean) => {
    const columns = checked ? [...config.columns, fieldName] : config.columns.filter((c) => c !== fieldName)
    patch({ columns })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Form</Label>
        <FormReferenceSelect value={config.formId} onChange={(formId) => patch({ formId: formId ?? '', columns: [] })} />
      </div>

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Visible columns</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[hsl(var(--border))] p-2">
            {form.fields.map((f) => (
              <Label key={f.name} className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
                <Checkbox checked={config.columns.includes(f.name)} onCheckedChange={(checked) => toggleColumn(f.name, checked === true)} />
                {f.label || f.name}
              </Label>
            ))}
            {form.fields.length === 0 && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">This form has no data fields yet.</p>}
          </div>
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Default filter</Label>
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
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Default sort</Label>
          <SortRuleList
            rules={ensureSortIds(config.defaultSort)}
            fields={form.fields.map((f) => ({ name: f.name, label: f.label }))}
            onChange={(sort) => patch({ defaultSort: sort })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Rows per page</Label>
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
        Let viewers filter this table
      </Label>

      <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
        <Checkbox checked={config.rowClick === 'record'} onCheckedChange={(c) => patch({ rowClick: c === true ? 'record' : 'none' })} />
        Clicking a row opens its details
      </Label>

      {form && (
        <div className="space-y-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Record scoping</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Only applies when this widget is placed on a form's Detail Page (a "Custom" tab, FR-D2-015) — ignored on an
            ordinary Dashboard. Pick a reference field on this form that points back at the record the tab is attached to.
          </p>
          {referenceFields.length === 0 ? (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">This form has no reference fields.</p>
          ) : (
            <SelectMenu
              value={config.scopeToRecord?.fieldName ?? '__none__'}
              onValueChange={(v) => patch({ scopeToRecord: v === '__none__' ? undefined : { fieldName: v } })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Not scoped" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs">Not scoped</SelectItem>
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
              <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
              <SelectItem value="desc" className="text-xs">Descending</SelectItem>
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
        + Sort rule
      </button>
    </div>
  )
}
