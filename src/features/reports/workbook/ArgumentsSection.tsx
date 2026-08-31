// Argument and binding authoring (FR-J1-006 DP-04/DP-05). This is the surface
// that makes a report a template rather than a fixed query: a declared
// argument is what the report list's Run prompt, the export_report action, and
// the generate_report node all fill in at run time (FR-D2-019).
import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForms } from '@/features/forms/hooks'
import { cn } from '@/lib/utils'
import {
  createArgument,
  createBinding,
  defaultOperatorFor,
  operatorsFor,
  supportsRange,
  RECORD_ID_FIELD,
} from '../data-sources'
import { useReportStore } from '../store'
import type { ArgumentType, CompareOp, ReportArgument, ReportDataSource } from '../types'

const TYPE_LABELS: Record<ArgumentType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
  reference: 'A record',
}

const OP_LABELS: Record<CompareOp, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is after / greater than',
  gte: 'is on or after / at least',
  lt: 'is before / less than',
  lte: 'is on or before / at most',
  contains: 'contains',
  starts_with: 'starts with',
  in: 'is any of',
  is_null: 'is empty',
  not_null: 'is not empty',
}

export function ArgumentsSection({ onBeforeChange }: { onBeforeChange?: () => void }) {
  const definition = useReportStore((state) => state.definition)
  const addArgument = useReportStore((state) => state.addArgument)
  const updateArgument = useReportStore((state) => state.updateArgument)
  const removeArgument = useReportStore((state) => state.removeArgument)

  const [openKey, setOpenKey] = useState<string | null>(null)

  const argumentList = definition.arguments ?? []
  const sources = definition.data_sources ?? []

  const guard = (mutation: () => void) => {
    onBeforeChange?.()
    mutation()
  }

  const add = () => {
    const argument = createArgument(argumentList)
    // BIND-06: pre-create one binding so a new argument is immediately
    // meaningful. It is a default the author may change or delete — never
    // implicit behavior at generation time.
    guard(() => addArgument(argument, createBinding(argument, sources)))
    setOpenKey(argument.key)
  }

  return (
    <section className="border-b border-[hsl(var(--border))] p-3" aria-labelledby="arguments-heading">
      <div className="mb-2 flex items-center justify-between">
        <h3 id="arguments-heading" className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          Inputs
        </h3>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={add}>
          <Plus size={11} /> Add
        </Button>
      </div>

      {argumentList.length === 0 ? (
        <p className="px-1 py-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
          An input is asked for when the report runs, then narrows a data source — one report answers
          "invoices for August" and "invoices for September" instead of needing two.
        </p>
      ) : (
        <div className="space-y-1">
          {argumentList.map((argument) => (
            <ArgumentRow
              key={argument.key}
              argument={argument}
              argumentList={argumentList}
              sources={sources}
              open={openKey === argument.key}
              onToggle={() => setOpenKey(openKey === argument.key ? null : argument.key)}
              onChange={(patch) => {
                guard(() => updateArgument(argument.key, patch))
                if (patch.key) setOpenKey(patch.key)
              }}
              onRemove={() => guard(() => removeArgument(argument.key))}
              onBeforeChange={onBeforeChange}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface ArgumentRowProps {
  argument: ReportArgument
  argumentList: ReportArgument[]
  sources: ReportDataSource[]
  open: boolean
  onToggle: () => void
  onChange: (patch: Partial<ReportArgument>) => void
  onRemove: () => void
  onBeforeChange?: () => void
}

function ArgumentRow({ argument, argumentList, sources, open, onToggle, onChange, onRemove, onBeforeChange }: ArgumentRowProps) {
  const { data: formList } = useForms()
  const keyProblem = argumentKeyProblem(argument, argumentList)

  return (
    <div className={cn('rounded-md border', open ? 'border-[hsl(var(--primary))]/40' : 'border-[hsl(var(--border))]')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-2 py-2 text-left">
        {open ? <ChevronDown size={12} className="shrink-0 opacity-60" /> : <ChevronRight size={12} className="shrink-0 opacity-60" />}
        <SlidersHorizontal size={12} className="shrink-0 text-[hsl(var(--primary))]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-[hsl(var(--foreground))]">
            {argument.label}
            {argument.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
          </span>
          <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">
            {TYPE_LABELS[argument.type]}{argument.range ? ' range' : ''} · {argument.key}
          </span>
        </span>
        {keyProblem && <AlertTriangle size={12} className="shrink-0 text-[hsl(var(--destructive))]" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-[hsl(var(--border))] p-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Label</Label>
            <Input value={argument.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">What the person is asked for when the report runs.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Key</Label>
            <Input
              value={argument.key}
              onChange={(e) => onChange({ key: e.target.value })}
              className="h-8 font-mono text-[12px]"
              aria-invalid={keyProblem ? true : undefined}
            />
            {keyProblem && <p className="text-[10px] leading-4 text-[hsl(var(--destructive))]">{keyProblem}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Type</Label>
            <SelectMenu
              value={argument.type}
              onValueChange={(type) => {
                const next = type as ArgumentType
                // Clearing range/form_id when they stop applying keeps the
                // saved definition honest — a text argument carrying a stale
                // range flag would be rejected on save.
                onChange({
                  type: next,
                  range: supportsRange(next) ? argument.range : undefined,
                  form_id: next === 'reference' ? argument.form_id : undefined,
                })
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as ArgumentType[]).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
          </div>

          {argument.type === 'reference' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Records from</Label>
              <SelectMenu value={argument.form_id ?? ''} onValueChange={(form_id) => onChange({ form_id })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a form…" /></SelectTrigger>
                <SelectContent>
                  {(formList ?? []).map((f) => <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>)}
                </SelectContent>
              </SelectMenu>
              {!argument.form_id && (
                <p className="text-[10px] leading-4 text-[hsl(var(--destructive))]">
                  A record input needs a form, or there is nothing to pick from.
                </p>
              )}
            </div>
          )}

          {supportsRange(argument.type) && (
            <label className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-[hsl(var(--foreground))]">Ask for a range</span>
                <span className="block text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
                  A from/to pair. There is no "between" operator — a range is compiled into an
                  at-least plus an at-most condition.
                </span>
              </span>
              <Switch checked={argument.range === true} onCheckedChange={(range) => onChange({ range: range || undefined })} />
            </label>
          )}

          <label className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-[hsl(var(--foreground))]">Required</span>
              <span className="block text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
                The report cannot run without it. Optional inputs left empty simply do not filter.
              </span>
            </span>
            <Switch checked={argument.required === true} onCheckedChange={(required) => onChange({ required: required || undefined })} />
          </label>

          <BindingsEditor argument={argument} sources={sources} onBeforeChange={onBeforeChange} />

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] text-[hsl(var(--destructive))]" onClick={onRemove}>
              <Trash2 size={11} /> Delete input
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function BindingsEditor({ argument, sources, onBeforeChange }: {
  argument: ReportArgument
  sources: ReportDataSource[]
  onBeforeChange?: () => void
}) {
  const definition = useReportStore((state) => state.definition)
  const addBinding = useReportStore((state) => state.addBinding)
  const updateBinding = useReportStore((state) => state.updateBinding)
  const removeBinding = useReportStore((state) => state.removeBinding)
  const { data: formList } = useForms()

  const all = definition.argument_bindings ?? []
  // Indices are kept alongside each binding because the store addresses
  // bindings positionally in the single flat list the schema persists.
  const mine = all.map((binding, index) => ({ binding, index })).filter((b) => b.binding.argument_key === argument.key)

  const guard = (mutation: () => void) => {
    onBeforeChange?.()
    mutation()
  }

  return (
    <div className="space-y-1.5 rounded-md border border-[hsl(var(--border))] p-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Narrows</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[10px]"
          onClick={() => {
            const created = createBinding(argument, sources)
            if (created) guard(() => addBinding(created))
          }}
          disabled={sources.length === 0}
        >
          <Plus size={10} /> Add
        </Button>
      </div>

      {sources.length === 0 ? (
        <p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
          Add a data source first — an input narrows a source, so it needs one to point at.
        </p>
      ) : mine.length === 0 ? (
        <p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
          Not connected to anything yet, so this input is collected and then ignored.
        </p>
      ) : (
        mine.map(({ binding, index }) => {
          const source = sources.find((s) => s.id === binding.source_id)
          const form = formList?.find((f) => f.id === source?.form_id)
          const ops = operatorsFor(binding.field)
          return (
            <div key={index} className="space-y-1.5 rounded border border-[hsl(var(--border))] p-2">
              <div className="flex items-center gap-1.5">
                <SelectMenu
                  value={binding.source_id}
                  onValueChange={(source_id) => guard(() => updateBinding(index, { source_id, field: '' }))}
                >
                  <SelectTrigger className="h-7 flex-1 text-[11px]"><SelectValue placeholder="Source…" /></SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
                  </SelectContent>
                </SelectMenu>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[hsl(var(--destructive))]"
                  aria-label="Remove binding"
                  onClick={() => guard(() => removeBinding(index))}
                >
                  <Trash2 size={11} />
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <SelectMenu
                  value={binding.field}
                  onValueChange={(field) => {
                    // Switching to or from the id narrowing changes which
                    // operators are legal, so snap to a valid one rather than
                    // leaving an operator the backend will reject.
                    const legal = operatorsFor(field)
                    const op = legal.includes(binding.op) ? binding.op : (field === RECORD_ID_FIELD ? 'eq' : defaultOperatorFor(argument.type))
                    guard(() => updateBinding(index, { field, op }))
                  }}
                >
                  <SelectTrigger className="h-7 flex-1 text-[11px]"><SelectValue placeholder="Field…" /></SelectTrigger>
                  <SelectContent>
                    {/* The record-identity narrowing, offered first because for
                        a reference input it is almost always what is wanted. */}
                    <SelectItem value={RECORD_ID_FIELD} className="text-xs">The record itself</SelectItem>
                    {(form?.fields ?? []).map((f) => (
                      <SelectItem key={f.name} value={f.name} className="text-xs">{f.label ?? f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </SelectMenu>

                <SelectMenu
                  value={binding.op}
                  onValueChange={(op) => guard(() => updateBinding(index, { op: op as CompareOp }))}
                  disabled={argument.range}
                >
                  <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {/* No `between` — it does not exist. A range argument
                        overrides this operator with its own gte/lte pair. */}
                    {ops.map((op) => <SelectItem key={op} value={op} className="text-xs">{OP_LABELS[op]}</SelectItem>)}
                  </SelectContent>
                </SelectMenu>
              </div>

              {argument.range && (
                <p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">
                  This is a range, so the operator is set for you — at least the "from" value, at most the "to".
                </p>
              )}
              {!binding.field && (
                <p className="text-[10px] leading-4 text-[hsl(var(--destructive))]">
                  Pick a field. An unset field is rejected when the report runs, rather than quietly matching everything.
                </p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function argumentKeyProblem(argument: ReportArgument, all: ReportArgument[]): string | undefined {
  if (!argument.key.trim()) return 'An input needs a key.'
  if (all.filter((a) => a.key === argument.key).length > 1) return `Another input already uses the key "${argument.key}".`
  return undefined
}
