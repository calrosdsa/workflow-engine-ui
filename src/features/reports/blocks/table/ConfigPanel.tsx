import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForms, useForm } from '@/features/forms/hooks'
import { useReportStore } from '../../store'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import { StyleEditor } from '../../StyleEditor'
import type { BlockStyle } from '../../types'
import type { TableBlockConfig, TableStyles } from './schema'

// Config surface for the "table" block type (FR-J1-002 §1): a form picker
// plus a column checklist (defaulting to every field when Columns is empty,
// matching internal/reports' own defaultColumns fallback, block_table.go).
// Computed-column expressions (FR-J1-004) are not exposed in this panel yet
// — a real gap, but out of scope for this slice (table/group blocks only,
// per the agreed build order); columns[].expression round-trips untouched
// if already present in a hand-authored definition.
export function TableBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<TableBlockConfig>) {
  const { data: forms } = useForms()
  const sources = useReportStore((state) => state.definition.data_sources) ?? []
  // DP-07: the data half of this panel is now a source selector. The form
  // picker survives only for a region authored before data sources existed
  // (DS-07) — it is shown only when that is actually the case, so a new
  // region never offers two competing ways to say where its rows come from.
  const source = sources.find((s) => s.id === config.source_id)
  const effectiveFormID = source?.form_id ?? config.form_id
  const { data: form } = useForm(effectiveFormID)

  const selectedKeys = new Set((config.columns ?? []).map((c) => c.key))
  const usingDefaultColumns = !config.columns || config.columns.length === 0

  const updateSectionStyle = (section: keyof TableStyles, style: BlockStyle) => {
    const next = { ...config.style, [section]: hasBlockStyle(style) ? style : undefined }
    onChange({ ...config, style: next.header || next.body ? next : undefined })
  }

  const toggleColumn = (key: string, checked: boolean) => {
    const base = usingDefaultColumns && form ? form.fields.map((f) => ({ key: f.name, label: f.label })) : (config.columns ?? [])
    const next = checked
      ? [...base.filter((c) => c.key !== key), { key }]
      : base.filter((c) => c.key !== key)
    onChange({ ...config, columns: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Data source</Label>
        <SelectMenu
          value={config.source_id ?? ''}
          onValueChange={(source_id) => onChange({ ...config, source_id, form_id: '', columns: [] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a data source…" /></SelectTrigger>
          <SelectContent>
            {sources.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                No data sources yet — add one at the top of this panel.
              </div>
            ) : (
              sources.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </SelectMenu>
        {source && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Its form, filter, sort, and limit come from the source — change them there and every
            region using it follows.
          </p>
        )}
      </div>

      {!config.source_id && config.form_id && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            Form <span className="font-normal">(this region predates data sources)</span>
          </Label>
          <SelectMenu
            value={config.form_id}
            onValueChange={(form_id) => onChange({ ...config, form_id, columns: [] })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a form…" /></SelectTrigger>
            <SelectContent>
              {(forms ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Still works as-is. Pick a data source above to gain filters and sorting.
          </p>
        </div>
      )}

      {form && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            Columns <span className="font-normal">(none checked = every field)</span>
          </Label>
          <div className="flex flex-col gap-1 rounded-md border border-[hsl(var(--border))] p-2">
            {form.fields.map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={usingDefaultColumns ? true : selectedKeys.has(f.name)}
                  onCheckedChange={(checked) => toggleColumn(f.name, checked === true)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          Row limit <span className="font-normal">(optional)</span>
        </Label>
        <Input
          type="number"
          min={0}
          value={config.limit ?? ''}
          onChange={(e) => onChange({ ...config, limit: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="Unlimited"
          className="h-8 text-sm"
        />
      </div>

      <details open className="rounded-md border border-[hsl(var(--border))] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[hsl(var(--foreground))]">Header style</summary>
        <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          Overrides the base table formatting for column headings only.
        </p>
        <div className="mt-3">
          <StyleEditor
            style={config.style?.header ?? {}}
            onChange={(style) => updateSectionStyle('header', style)}
          />
        </div>
      </details>

      <details className="rounded-md border border-[hsl(var(--border))] p-3">
        <summary className="cursor-pointer text-xs font-semibold text-[hsl(var(--foreground))]">Body style</summary>
        <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          Overrides the base table formatting for data rows only.
        </p>
        <div className="mt-3">
          <StyleEditor
            style={config.style?.body ?? {}}
            onChange={(style) => updateSectionStyle('body', style)}
          />
        </div>
      </details>
    </div>
  )
}

function hasBlockStyle(style: BlockStyle): boolean {
  return style.bold !== undefined
    || style.italic !== undefined
    || style.align !== undefined
    || style.text_color !== undefined
    || style.fill_color !== undefined
    || style.border !== undefined
    || style.padding !== undefined
}
