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
//
// Colors are applied as Tailwind arbitrary-value classes (not inline `style`
// objects) so hover/focus-visible variants actually take effect — an inline
// style's background/border wins the cascade over any class, which silently
// defeated hover states the previous version of this file tried to add.

import { useState, Fragment } from 'react'
import { Plus, Trash2, Code2, FolderPlus, Braces, ListFilter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from '@/components/ui/select-menu'
import { DatePicker, DateTimePicker } from '@/components/ui/date-time-picker'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { FilterReferenceValuePicker } from './FilterReferenceValuePicker'
import { nanoid } from './nanoid'
import type { NodeOutputSchema } from './node-output-schema'
import { mergeSystemFields } from '@/features/forms/types'
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

/** One labeled section of the field picker — e.g. "Trigger Record" or
 *  "Workflow Variables". Purely a rendering concern: `fields` (the flat
 *  list every other lookup in this file uses) is unaffected either way. */
export interface FieldGroup {
  label: string
  fields: FieldDef[]
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
  /** Renders the Field picker as labeled sections instead of one flat list —
   *  e.g. one section per upstream node plus "Workflow Variables". Only the
   *  workflow canvas's Condition node passes this (it has real node/variable
   *  context to group by); every other caller (Fetch/Update/Delete Records'
   *  filter, a single form's own field list) has nothing to group and omits
   *  it, keeping their existing flat `fields` list unchanged. */
  fieldGroups?: FieldGroup[]
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

export function FilterBuilder({ group, fields, variables, nodeContext = [], onChange, onRemove, depth = 0, hideExpressions = false, fieldGroups }: FilterBuilderProps) {
  // Every caller's `fields` ultimately means "what can this condition match
  // against" — for the common case (a form's own declared fields) that's
  // missing id/created_at/updated_at, which exist on every record but are
  // deliberately absent from FormDefinition.fields (see SYSTEM_FIELDS's doc
  // comment). Merging here, once, means every current and future caller gets
  // them for free instead of relying on each call site to remember its own
  // copy — several didn't (that's the bug this fixes). Harmless for callers
  // whose `fields` isn't form-shaped (e.g. the Condition node's workflow
  // variables): fieldGroups, not this flat list, drives the rendered
  // dropdown there, so an unused synthetic entry never surfaces.
  const fieldsWithSystem = mergeSystemFields(fields)

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
    <div className={cn('rounded-xl border border-[hsl(var(--border))] p-3', depth === 0 ? 'bg-[hsl(var(--muted))]/40' : 'bg-[hsl(var(--card))]')}>
      {/* Header: AND/OR toggle + remove */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex gap-0.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-0.5">
          {(['and', 'or'] as const).map((c) => {
            const selected = group.combinator === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCombinator(c)}
                aria-pressed={selected}
                className={cn(
                  'rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                  selected
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                )}
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
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {isEmpty && (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[hsl(var(--border))] px-2 py-5 text-center">
          <ListFilter size={16} className="text-[hsl(var(--muted-foreground))]/50" />
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">No conditions yet — add one below.</p>
        </div>
      )}

      {/* Leaf conditions, with a small AND/OR connector between adjacent
          rows so a multi-condition group reads correctly without having to
          look back up at the header toggle. */}
      <div className="space-y-1.5">
        {group.conditions.map((c, idx) => (
          <Fragment key={c.id}>
            <ConditionRow
              condition={c}
              fields={fieldsWithSystem}
              variables={variables}
              nodeContext={nodeContext}
              onChange={(patch) => updateCondition(c.id, patch)}
              onRemove={() => removeCondition(c.id)}
              hideExpressions={hideExpressions}
              fieldGroups={fieldGroups}
            />
            {(idx < group.conditions.length - 1 || group.groups.length > 0) && (
              <Connector combinator={group.combinator} />
            )}
          </Fragment>
        ))}
      </div>

      {/* Nested groups */}
      {group.groups.length > 0 && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-[hsl(var(--border))] pl-2.5">
          {group.groups.map((g, idx) => (
            <Fragment key={g.id ?? idx}>
              <FilterBuilder
                group={g}
                fields={fieldsWithSystem}
                variables={variables}
                nodeContext={nodeContext}
                onChange={(ng) => updateGroup(idx, ng)}
                onRemove={() => removeGroup(idx)}
                depth={depth + 1}
                hideExpressions={hideExpressions}
                fieldGroups={fieldGroups}
              />
              {idx < group.groups.length - 1 && <Connector combinator={group.combinator} />}
            </Fragment>
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

// Small centered "and"/"or" chip rendered between sibling conditions/groups —
// purely presentational (reads the shared group.combinator, no state of its
// own) so a group of 3+ conditions doesn't force the reader to scroll back up
// to the header toggle to know how the rows below relate to each other.
function Connector({ combinator }: { combinator: 'and' | 'or' }) {
  return (
    <div className="flex items-center justify-center py-0.5" aria-hidden="true">
      <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {combinator}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single condition row
// ---------------------------------------------------------------------------

function ConditionRow({ condition, fields, variables, nodeContext, onChange, onRemove, hideExpressions = false, fieldGroups }: {
  condition: FilterCondition
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (patch: Partial<FilterCondition>) => void
  onRemove: () => void
  hideExpressions?: boolean
  fieldGroups?: FieldGroup[]
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
    <div className="min-w-0 flex-1 truncate rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-1.5 text-[11px] italic text-[hsl(var(--muted-foreground))]">
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
      groups={fieldGroups?.map((g) => ({ label: g.label, options: g.fields.map((f) => ({ value: f.name, label: f.label || f.name })) }))}
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      <Trash2 size={13} />
    </button>
  )

  // Both layouts this component renders (the builder canvas's own two-row
  // form and this context's single inline row) now sit the value control
  // in a flex row beside a trailing control (the expression toggle, or
  // nothing) — always flex-1, never a lone full-width block.
  const valueWidthClass = 'min-w-0 flex-1'

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

  // Toggles value_mode between a static value and an Expr expression — a
  // compact icon button rather than the two-word tab bar this used to be,
  // since the choice is minor and made per-condition; a dedicated full-width
  // row for it got expensive fast on a group with several conditions.
  const exprToggle = (
    <button
      type="button"
      onClick={() => onChange({ value_mode: isExpr ? 'static' : 'expression' })}
      title={isExpr ? 'Switch to a static value' : 'Use an expression instead of a static value'}
      aria-label={isExpr ? 'Switch to a static value' : 'Use an expression instead of a static value'}
      aria-pressed={isExpr}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
        isExpr
          ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
      )}
    >
      <Braces size={13} />
    </button>
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
      <div className="flex min-w-[26rem] items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 transition-colors">
        {fieldControl}
        {operatorControl}
        {needsValue && valueControl}
        {removeButton}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 transition-colors hover:border-[hsl(var(--foreground))]/15">
      <div className="flex items-center gap-1.5">
        {fieldControl}
        {operatorControl}
        {needsValue && (isExpr ? (
          <>
            <input
              value={condition.expression ?? ''}
              onChange={(e) => onChange({ expression: e.target.value })}
              placeholder='Vars["country"]'
              className="h-7 min-w-0 flex-1 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 font-mono text-[11px] text-[hsl(var(--foreground))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
            <button
              onClick={() => setEditorOpen(true)}
              title="Open expression editor"
              aria-label="Open expression editor"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <Code2 size={13} />
            </button>
          </>
        ) : (
          valueControl
        ))}
        {needsValue && exprToggle}
        {removeButton}
      </div>

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

function SelectField({ value, onChange, options, groups, placeholder, className, size = 'compact' }: {
  value: string
  onChange: (v: string) => void
  /** Flat option list — ignored when `groups` is given. */
  options?: { value: string; label: string }[]
  /** Labeled sections (e.g. one per upstream node, plus "Workflow
   *  Variables") — only the Condition node's field picker passes this today. */
  groups?: { label: string; options: { value: string; label: string }[] }[]
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
        {groups
          ? groups.map((g) => (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.options.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>
                ))}
              </SelectGroup>
            ))
          : (options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>
            ))}
      </SelectContent>
    </SelectMenu>
  )
}
