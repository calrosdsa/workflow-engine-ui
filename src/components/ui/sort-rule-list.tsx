// Shared sort-rule editor — extracted from menus/saved-views/SaveViewDialog.tsx
// (which now imports it) so a second caller (FR-D2-015's related_form detail-
// tab config panel) doesn't duplicate it. Styled via hsl(var(--...)) tokens
// (not SaveViewDialog's original plain slate-* classes) so it renders
// correctly in both the light App Builder shell and the dark runtime — same
// reasoning FilterBuilder.tsx's own top comment gives for the identical
// token choice.
import { Select } from '@/components/ui/select'
import { nanoid } from '@/features/workflows/builder/nanoid'
import type { SortRule } from '@/features/workflows/types'

export function SortRuleList({ rules, fields, onChange }: {
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
          <Select value={r.field} onChange={(e) => updateRule(r.id, { field: e.target.value })} className="h-8 min-w-0 flex-1 text-[11px]">
            {fields.map((f) => (
              <option key={f.name} value={f.name}>{f.label || f.name}</option>
            ))}
          </Select>
          <Select value={r.dir} onChange={(e) => updateRule(r.id, { dir: e.target.value as 'asc' | 'desc' })} className="h-8 w-auto shrink-0 text-[11px]">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </Select>
          <button
            type="button"
            onClick={() => removeRule(r.id)}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] hover:text-[hsl(var(--destructive))]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="w-full rounded-md border border-dashed py-1 text-[11px] transition-colors hover:bg-[hsl(var(--accent))]"
        style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
      >
        + Sort rule
      </button>
    </div>
  )
}
