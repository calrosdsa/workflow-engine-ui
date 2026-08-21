// Recursive AND/OR filter builder for the Fetch Records node.
//
// Renders a FilterGroup tree: each group has an AND/OR combinator, leaf
// conditions ({field, op, value|expression}), and nested sub-groups. Condition
// values can be static or an Expr expression (opening the shared ExpressionEditor).
//
// Styled entirely through hsl(var(--...)) design tokens (see src/index.css),
// not hardcoded slate-*/rose-* Tailwind classes — this component renders in
// both the light-only App Builder workflow canvas AND the theme-aware
// runtime (a saved view's Filter section, RecordsTable's own filter panel),
// and the old hardcoded palette showed as a jarring white card in the dark
// runtime theme. Tokens resolve correctly in both places since :root/.dark
// both define the full palette.

import { useState } from 'react'
import { Plus, Trash2, Code2, FolderPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { DatePicker, DateTimePicker } from '@/components/ui/date-time-picker'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { FilterReferenceValuePicker } from './FilterReferenceValuePicker'
import { nanoid } from './nanoid'
import type { NodeOutputSchema } from './node-output-schema'
import type { FieldDef } from '@/features/forms/types'
import type { VariableDecl, FilterGroup, FilterCondition, CompareOp } from '../types'

const OPERATORS: { value: CompareOp; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'in', label: 'in list' },
  { value: 'is_null', label: 'is empty' },
  { value: 'not_null', label: 'is not empty' },
  // Matches the form's combined full-text search column, not the selected
  // field — the field picker is ignored for this op (see CompareOp's doc
  // comment in ../types).
  { value: 'search', label: 'full-text search' },
  // Change-detection — only meaningful where an old/new record pair exists
  // (a Trigger node's before/after/after_async filter). Harmless elsewhere:
  // evaluates false when there's no old record to compare against.
  { value: 'was_updated', label: 'was updated' },
]

function opNeedsValue(op: CompareOp): boolean {
  return op !== 'is_null' && op !== 'not_null' && op !== 'was_updated'
}

/** True when op ignores the condition's `field` (matches the whole record
 *  instead of one column) — currently only full-text search. */
function opIgnoresField(op: CompareOp): boolean {
  return op === 'search'
}

export function newCondition(): FilterCondition {
  return { id: nanoid(), field: '', op: 'eq', value_mode: 'static', value: '', expression: '' }
}

export function newGroup(): FilterGroup {
  return { id: nanoid(), combinator: 'and', conditions: [], groups: [] }
}

interface FilterBuilderProps {
  group: FilterGroup
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext?: NodeOutputSchema[]
  onChange: (g: FilterGroup) => void
  /** Root group can't be removed; nested groups get a remove handler. */
  onRemove?: () => void
  depth?: number
  /** Hides the Value/Expression toggle and the Expr expression input/editor
   *  entirely — a condition can only ever be a static value. Expr is an
   *  engineering-facing scripting surface (Vars[...], NodeOutputs[...]) that
   *  belongs in the workflow builder canvas, not the runtime end-user Search
   *  menu filter, which has no workflow variables or upstream node outputs
   *  to reference in the first place. Also collapses each condition onto a
   *  single row (no separate Value line below Field/Operator), since without
   *  the toggle there's nothing that needs the second row's height. Off by
   *  default — every builder-canvas caller (node config forms) keeps the
   *  existing two-row, expression-capable layout unchanged. */
  hideExpressions?: boolean
}

export function FilterBuilder({ group, fields, variables, nodeContext = [], onChange, onRemove, depth = 0, hideExpressions = false }: FilterBuilderProps) {
  const setCombinator = (combinator: 'and' | 'or') => onChange({ ...group, combinator })

  const addCondition = () => onChange({ ...group, conditions: [...group.conditions, newCondition()] })
  const addGroup = () => onChange({ ...group, groups: [...group.groups, newGroup()] })

  const updateCondition = (id: string, patch: Partial<FilterCondition>) =>
    onChange({ ...group, conditions: group.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const removeCondition = (id: string) =>
    onChange({ ...group, conditions: group.conditions.filter((c) => c.id !== id) })

  const updateGroup = (idx: number, g: FilterGroup) =>
    onChange({ ...group, groups: group.groups.map((x, i) => (i === idx ? g : x)) })
  const removeGroup = (idx: number) =>
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== idx) })

  const isEmpty = group.conditions.length === 0 && group.groups.length === 0

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: 'hsl(var(--border))',
        backgroundColor: depth === 0 ? 'hsl(var(--muted) / 0.4)' : 'hsl(var(--card))',
      }}
    >
      {/* Header: AND/OR toggle + remove */}
      <div className="mb-2.5 flex items-center justify-between">
        <div
          className="flex gap-0.5 rounded-lg border p-0.5"
          style={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
        >
          {(['and', 'or'] as const).map((c) => {
            const selected = group.combinator === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCombinator(c)}
                aria-pressed={selected}
                className="rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                style={
                  selected
                    ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
                    : { color: 'hsl(var(--muted-foreground))' }
                }
              >
                {c}
              </button>
            )
          })}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remove group"
            aria-label="Remove group"
            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {isEmpty && (
        <p
          className="rounded-lg border border-dashed px-2 py-3 text-center text-[11px]"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
        >
          No conditions yet.
        </p>
      )}

      {/* Leaf conditions */}
      <div className="space-y-1.5">
        {group.conditions.map((c) => (
          <ConditionRow
            key={c.id}
            condition={c}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(patch) => updateCondition(c.id, patch)}
            onRemove={() => removeCondition(c.id)}
            hideExpressions={hideExpressions}
          />
        ))}
      </div>

      {/* Nested groups */}
      {group.groups.length > 0 && (
        <div className="mt-1.5 space-y-1.5 border-l-2 pl-2.5" style={{ borderColor: 'hsl(var(--border))' }}>
          {group.groups.map((g, idx) => (
            <FilterBuilder
              key={g.id ?? idx}
              group={g}
              fields={fields}
              variables={variables}
              nodeContext={nodeContext}
              onChange={(ng) => updateGroup(idx, ng)}
              onRemove={() => removeGroup(idx)}
              depth={depth + 1}
              hideExpressions={hideExpressions}
            />
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div className="mt-2.5 flex gap-1.5">
        <Button variant="outline" size="sm" onClick={addCondition} className="h-7 flex-1 gap-1.5 border-dashed text-[11px]">
          <Plus size={12} /> Condition
        </Button>
        {depth < 3 && (
          <Button variant="outline" size="sm" onClick={addGroup} className="h-7 gap-1.5 border-dashed text-[11px]">
            <FolderPlus size={12} /> Group
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single condition row
// ---------------------------------------------------------------------------

function ConditionRow({ condition, fields, variables, nodeContext, onChange, onRemove, hideExpressions = false }: {
  condition: FilterCondition
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (patch: Partial<FilterCondition>) => void
  onRemove: () => void
  hideExpressions?: boolean
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const needsValue = opNeedsValue(condition.op)
  const ignoresField = opIgnoresField(condition.op)
  // Forced static when expressions are hidden — a condition already carrying
  // value_mode: 'expression' from before this context stopped allowing it
  // (e.g. a saved view whose filter was authored in the workflow canvas)
  // still renders and evaluates as a plain value input here, never a
  // hidden/inaccessible expression field the runtime viewer can't see or edit.
  const isExpr = !hideExpressions && condition.value_mode === 'expression'
  const selectedField = fields.find((f) => f.name === condition.field)
  // "in list" always keeps the plain comma-separated text input, for every
  // special value type below — none of a <select>, a date input, or a
  // single-record picker can express "type several values separated by
  // commas" the way free text already does, and building a real multi-value
  // picker for each type is real added scope beyond what was asked here.
  const isMultiValue = condition.op === 'in'
  // An enum field's Value input becomes a picker of its real enum_values —
  // previously a plain text box regardless of field type, so choosing e.g.
  // "Status = active" required typing the raw stored value from memory with
  // no indication of what the valid values even were (enum_values IS the
  // display text here; this codebase's enum fields have no separate
  // label/value pair — see FieldDef.enum_values, string[]).
  const isEnumValue = selectedField?.type === 'enum' && !!selectedField.enum_values?.length && !isMultiValue
  const isBooleanValue = selectedField?.type === 'boolean' && !isMultiValue
  const isDateValue = selectedField?.type === 'date' && !isMultiValue
  const isDatetimeValue = selectedField?.type === 'datetime' && !isMultiValue
  const isReferenceValue = selectedField?.type === 'reference' && !!selectedField.reference_table && !isMultiValue

  const fieldControl = ignoresField ? (
    <div
      className="min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-[11px] italic"
      style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
    >
      whole record
    </div>
  ) : (
    <SelectField
      value={condition.field}
      // Switching fields resets the value — a Created At datetime string,
      // an enum's raw option value, a picked reference id, none of it means
      // anything once the field it was chosen for is gone, and silently
      // carrying it over risks a stale, wrong-typed value applying against
      // the newly selected field (typing "true" for a boolean, then
      // switching to Status without touching Value, would otherwise leave
      // Status = "true" filtering nothing at all). Expression mode/text is
      // untouched — switching the field mid-expression doesn't invalidate
      // the expression itself the way a static value does.
      onChange={(v) => onChange({ field: v, value: '' })}
      placeholder="field…"
      options={fields.map((f) => ({ value: f.name, label: f.label || f.name }))}
      className="min-w-0 flex-1"
    />
  )

  const operatorControl = (
    <SelectField
      value={condition.op}
      onChange={(v) => onChange({ op: v as CompareOp, field: v === 'search' ? '_search' : condition.field })}
      options={OPERATORS}
      className="w-[7.5rem] shrink-0"
    />
  )

  const removeButton = (
    <button
      onClick={onRemove}
      title="Remove condition"
      aria-label="Remove condition"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      style={{ color: 'hsl(var(--muted-foreground))' }}
    >
      <Trash2 size={13} />
    </button>
  )

  // Value/2's whole-column width vs. inline-flex-1 split matches the two
  // layouts ConditionRow itself renders in below (the builder canvas's own
  // full-width second row vs. this context's single inline row) — kept as
  // one shared className expression so every branch stays consistent rather
  // than repeating the ternary at each call site.
  const valueWidthClass = hideExpressions ? 'min-w-0 flex-1' : 'w-full'

  const valueControl = isEnumValue ? (
    <SelectField
      value={condition.value == null ? '' : String(condition.value)}
      onChange={(v) => onChange({ value: v })}
      placeholder="select value…"
      options={selectedField!.enum_values!.map((v) => ({ value: v, label: v }))}
      className={valueWidthClass}
      size="value"
    />
  ) : isBooleanValue ? (
    <SelectField
      value={condition.value == null || condition.value === '' ? '' : String(condition.value)}
      onChange={(v) => onChange({ value: v === '' ? '' : v === 'true' })}
      placeholder="select…"
      options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
      className={valueWidthClass}
      size="value"
    />
  ) : isDateValue ? (
    <DatePicker
      value={condition.value == null ? '' : String(condition.value)}
      onChange={(v) => onChange({ value: v })}
      className={valueWidthClass}
      size="sm"
    />
  ) : isDatetimeValue ? (
    <DateTimePicker
      value={condition.value == null ? '' : String(condition.value)}
      onChange={(v) => onChange({ value: v })}
      className={valueWidthClass}
      size="sm"
    />
  ) : isReferenceValue ? (
    <FilterReferenceValuePicker
      targetFormId={selectedField!.reference_table!}
      displayField={selectedField!.display_field}
      value={condition.value == null ? '' : String(condition.value)}
      onChange={(v) => onChange({ value: v })}
      className={valueWidthClass}
    />
  ) : (
    <Input
      value={condition.value == null ? '' : String(condition.value)}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={isMultiValue ? 'comma,separated,values' : 'value…'}
      className={cn('h-7 text-[12px]', valueWidthClass)}
    />
  )

  if (hideExpressions) {
    // Single row: Field, Operator, Value (when the operator needs one),
    // Delete — no Value/Expression toggle and no second row, since there's
    // no expression mode to switch into. This is the runtime Search-menu
    // filter's own layout (RecordsTable.tsx's FilterBuilder call, wrapped in
    // a bounded Dialog rather than the workflow canvas's full inline panel);
    // Expr scripting (Vars[...], NodeOutputs[...]) has no meaning for an
    // end-user filtering their own records, so it's never rendered here at
    // all — not hidden behind a toggle, not reachable.
    return (
      <div
        className="flex min-w-[26rem] items-center gap-1.5 rounded-lg border p-2 transition-colors"
        style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
      >
        {fieldControl}
        {operatorControl}
        {needsValue && valueControl}
        {removeButton}
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border p-2 transition-colors"
      style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
    >
      <div className="flex items-center gap-1.5">
        {fieldControl}
        {operatorControl}
        {removeButton}
      </div>

      {/* Value (static or expression) */}
      {needsValue && (
        <div className="mt-1.5 space-y-1.5">
          <div className="flex gap-0.5 rounded-md p-0.5" style={{ backgroundColor: 'hsl(var(--muted))' }}>
            {(['static', 'expression'] as const).map((m) => {
              const selected = (condition.value_mode ?? 'static') === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ value_mode: m })}
                  aria-pressed={selected}
                  className="flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                  style={
                    selected
                      ? { backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', boxShadow: '0 1px 2px hsl(var(--foreground) / 0.06)' }
                      : { color: 'hsl(var(--muted-foreground))' }
                  }
                >
                  {m === 'static' ? 'Value' : 'Expression'}
                </button>
              )
            })}
          </div>

          {isExpr ? (
            <div className="flex items-center gap-1.5">
              <input
                value={condition.expression ?? ''}
                onChange={(e) => onChange({ expression: e.target.value })}
                placeholder='Vars["country"]'
                className="h-7 min-w-0 flex-1 rounded-md border px-2 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                style={{ borderColor: 'hsl(var(--input))', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
              />
              <button
                onClick={() => setEditorOpen(true)}
                title="Open expression editor"
                aria-label="Open expression editor"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
              >
                <Code2 size={13} />
              </button>
            </div>
          ) : (
            valueControl
          )}
        </div>
      )}

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={condition.expression ?? ''}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label={condition.field || 'filter value'}
      />
    </div>
  )
}

// Radix's real dropdown (select-menu.tsx) shared by the Field/Operator/
// enum-Value/boolean-Value pickers — replaces an earlier plain native
// <select> (same one components/ui/select.tsx's own doc comment defends
// elsewhere in this codebase) with a proper popover menu: checkmarks,
// keyboard nav, and no OS-chrome dropdown that looks out of place next to
// the rest of this panel's Radix-based primitives (Popover, Command). Radix
// disallows an empty-string item value, so the placeholder/"none selected"
// state is a distinct EMPTY sentinel translated back to '' at the
// value/onChange boundary — the same pattern DisplayFieldSelect.tsx's own
// AUTO sentinel already establishes for this codebase's other SelectMenu-
// with-a-none-option call sites.
const SELECT_FIELD_EMPTY = '__empty__'

function SelectField({ value, onChange, options, placeholder, className, size = 'compact' }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  size?: 'compact' | 'value'
}) {
  return (
    <SelectMenu
      value={value === '' ? SELECT_FIELD_EMPTY : value}
      onValueChange={(v) => onChange(v === SELECT_FIELD_EMPTY ? '' : v)}
    >
      <SelectTrigger className={cn(size === 'value' ? 'h-7 text-[12px]' : 'h-8 text-[11px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent container={document.getElementById('runtime-root') ?? document.body}>
        {placeholder && <SelectItem value={SELECT_FIELD_EMPTY} className="text-[12px] italic">{placeholder}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}
