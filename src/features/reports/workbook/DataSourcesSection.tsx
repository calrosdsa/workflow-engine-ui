// The panel's primary section (FR-J1-006 DP-01/DP-02/DP-03): the report's
// named datasets, each with a form, filter, sort, and row limit. This replaces
// the "Insert region" grid as the panel's top-level content — insertion moves
// into the sheet (SN-01), which is what makes the trade a simplification
// rather than a relocation.
import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Database, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { FilterBuilder } from '@/features/workflows/builder/FilterBuilder'
import { useForms } from '@/features/forms/hooks'
import { cn } from '@/lib/utils'
import {
  createDataSource,
  effectiveSources,
  findBlockReferences,
  findFormulaReferences,
  normalizeFilterGroup,
  validateSourceName,
  type EffectiveSource,
} from '../data-sources'
import { useReportStore } from '../store'
import type { FormDefinition } from '@/features/forms/types'
import type { ReportDataSource, SortRule } from '../types'

interface DataSourcesSectionProps {
  /** Saves the live workbook before a mutation can refresh the editor adapter,
   *  matching how the region controls already guard author cell edits. */
  onBeforeChange?: () => void
}

export function DataSourcesSection({ onBeforeChange }: DataSourcesSectionProps) {
  const definition = useReportStore((state) => state.definition)
  const addDataSource = useReportStore((state) => state.addDataSource)
  const updateDataSource = useReportStore((state) => state.updateDataSource)
  const removeDataSource = useReportStore((state) => state.removeDataSource)
  const { data: formList } = useForms()

  const [openID, setOpenID] = useState<string | null>(null)

  const formName = (id: string) => formList?.find((f) => f.id === id)?.name
  const sources = effectiveSources(definition, formName)
  const declared = definition.data_sources ?? []

  const guard = (mutation: () => void) => {
    onBeforeChange?.()
    mutation()
  }

  const addSource = () => {
    const form = formList?.[0]
    if (!form) return
    const source = createDataSource(form.id, form.name, declared)
    guard(() => addDataSource(source))
    setOpenID(source.id)
  }

  return (
    <section className="border-b border-[hsl(var(--border))] p-3" aria-labelledby="data-sources-heading">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="data-sources-heading" className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Data sources
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[11px]"
          onClick={addSource}
          disabled={!formList || formList.length === 0}
        >
          <Plus size={11} /> Add
        </Button>
      </div>

      {sources.length === 0 ? (
        <p className="px-1 py-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          A data source is a form plus an optional filter and sort. Add one, then select cells in the
          sheet and insert it.
        </p>
      ) : (
        <div className="space-y-1">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              forms={formList ?? []}
              declared={declared}
              open={openID === source.id}
              onToggle={() => setOpenID(openID === source.id ? null : source.id)}
              onChange={(patch) => guard(() => updateDataSource(source.id, patch))}
              onRemove={() => {
                const blocks = findBlockReferences(definition, source.id)
                const formulas = findFormulaReferences(definition, source.name)
                // §6 row 2: name the consumers before deleting. Deleting anyway
                // is allowed — it just must never be silent.
                if (blocks.length > 0 || formulas.length > 0) {
                  const parts = [
                    blocks.length > 0 ? `${blocks.length} region${blocks.length === 1 ? '' : 's'} (${blocks.join(', ')})` : '',
                    formulas.length > 0 ? `${formulas.length} formula${formulas.length === 1 ? '' : 's'} (${formulas.map((f) => f.address).join(', ')})` : '',
                  ].filter(Boolean).join(' and ')
                  if (!window.confirm(`"${source.name}" is used by ${parts}. Delete it anyway? Those will keep pointing at a source that no longer exists.`)) return
                }
                guard(() => removeDataSource(source.id))
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface SourceRowProps {
  source: EffectiveSource
  forms: FormDefinition[]
  declared: ReportDataSource[]
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<ReportDataSource>) => void
  onRemove: () => void
}

function SourceRow({ source, forms, declared, open, onToggle, onChange, onRemove }: SourceRowProps) {
  const definition = useReportStore((state) => state.definition)
  const form = forms.find((f) => f.id === source.form_id)
  const nameProblem = source.implicit ? undefined : validateSourceName(source.name, declared, source.id)

  // RN-01: renaming is what breaks formulas, since blocks reference a source
  // by id and never by name. Surfaced live rather than only on save, so the
  // author sees it while the old name is still in front of them.
  const breakages = source.implicit ? [] : findFormulaReferences(definition, source.name)

  if (source.implicit) {
    return (
      <div className="rounded-md border border-dashed border-[hsl(var(--border))] px-2 py-2">
        <div className="flex items-center gap-2">
          <Database size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[hsl(var(--foreground))]">{source.name}</span>
          <span className="shrink-0 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            From region
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
          This report predates named data sources — {form?.name ?? 'its form'} comes straight from a region.
          It still works; add a data source to gain filters and sorting.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-md border', open ? 'border-[hsl(var(--primary))]/40' : 'border-[hsl(var(--border))]')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2 py-2 text-left"
      >
        {open ? <ChevronDown size={12} className="shrink-0 opacity-60" /> : <ChevronRight size={12} className="shrink-0 opacity-60" />}
        <Database size={12} className="shrink-0 text-[hsl(var(--primary))]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[hsl(var(--foreground))]">{source.name}</span>
          <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{form?.name ?? 'Form unavailable'}</span>
        </span>
        {nameProblem && <AlertTriangle size={12} className="shrink-0 text-[hsl(var(--destructive))]" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-[hsl(var(--border))] p-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Name</Label>
            <Input
              value={source.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="h-8 text-sm"
              aria-invalid={nameProblem ? true : undefined}
            />
            {nameProblem ? (
              <p className="text-[10px] leading-4 text-[hsl(var(--destructive))]">{nameProblem.message}</p>
            ) : (
              <p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
                Reference it from any cell — e.g. <code>=SUM({source.name}[Amount])</code>
              </p>
            )}
            {breakages.length > 0 && (
              <p className="rounded bg-[hsl(var(--warning))]/10 px-2 py-1.5 text-[10px] leading-4 text-[hsl(var(--warning))]">
                {breakages.length === 1
                  ? `${breakages[0].address} references this name.`
                  : `${breakages.length} cells reference this name (${breakages.slice(0, 4).map((b) => b.address).join(', ')}${breakages.length > 4 ? '…' : ''}).`}{' '}
                Renaming it will break {breakages.length === 1 ? 'that formula' : 'those formulas'} — they are not rewritten automatically.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Form</Label>
            <SelectMenu value={source.form_id} onValueChange={(form_id) => onChange({ form_id })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a form…" /></SelectTrigger>
              <SelectContent>
                {forms.map((f) => <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>)}
              </SelectContent>
            </SelectMenu>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Filter</Label>
            {/* hideExpressions: a report data source has no workflow variables
                or upstream node outputs to reference, exactly like the runtime
                Search menu's filter. */}
            <FilterBuilder
              group={normalizeFilterGroup(source.filter)}
              fields={form?.fields ?? []}
              variables={[]}
              hideExpressions
              onChange={(filter) => onChange({ filter })}
            />
          </div>

          <SortEditor
            sort={source.sort ?? []}
            fields={(form?.fields ?? []).map((f) => ({ name: f.name, label: f.label ?? f.name }))}
            onChange={(sort) => onChange({ sort: sort.length > 0 ? sort : undefined })}
          />

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
              Row limit <span className="font-normal">(optional)</span>
            </Label>
            <Input
              type="number"
              min={1}
              value={source.limit ?? ''}
              placeholder="No limit"
              onChange={(e) => {
                const next = Number(e.target.value)
                onChange({ limit: Number.isFinite(next) && next > 0 ? Math.floor(next) : undefined })
              }}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              The report's overall row cap still applies — a limit narrows, it never raises the ceiling.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] text-[hsl(var(--destructive))]"
              onClick={onRemove}
            >
              <Trash2 size={11} /> Delete source
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Genuinely new authoring surface: no report block config exposes sort today
// (verified — TableBlockConfig carries only FormID, Columns, Limit, Filter,
// Style), so there was no existing sort editor in this feature to reuse.
function SortEditor({ sort, fields, onChange }: {
  sort: SortRule[]
  fields: Array<{ name: string; label: string }>
  onChange: (sort: SortRule[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Sort</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => onChange([...sort, { field: fields[0]?.name ?? '', dir: 'asc' }])}
          disabled={fields.length === 0}
        >
          <Plus size={10} /> Add
        </Button>
      </div>
      {sort.length === 0 ? (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Unsorted — rows come back in the form's default order.</p>
      ) : (
        sort.map((rule, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <SelectMenu
              value={rule.field}
              onValueChange={(field) => onChange(sort.map((r, i) => (i === index ? { ...r, field } : r)))}
            >
              <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Field…" /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => <SelectItem key={f.name} value={f.name} className="text-xs">{f.label}</SelectItem>)}
              </SelectContent>
            </SelectMenu>
            <SelectMenu
              value={rule.dir}
              onValueChange={(dir) => onChange(sort.map((r, i) => (i === index ? { ...r, dir: dir as 'asc' | 'desc' } : r)))}
            >
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                <SelectItem value="desc" className="text-xs">Descending</SelectItem>
              </SelectContent>
            </SelectMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[hsl(var(--destructive))]"
              aria-label="Remove sort rule"
              onClick={() => onChange(sort.filter((_, i) => i !== index))}
            >
              <Trash2 size={11} />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}
