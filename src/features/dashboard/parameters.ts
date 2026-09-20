// ---------------------------------------------------------------------------
// Dashboard parameters
// ---------------------------------------------------------------------------
//
// A dashboard declares typed inputs; a viewer sets them once; every bound
// tile narrows. Without this, the same filter has to be pasted into each of
// twelve tiles and edited twelve times.
//
// Bindings are resolved HERE, in one place, and handed to each tile as an
// ordinary FilterGroup it merges into its own filter. Resolving per widget
// instead would put the binding semantics inside every widget type and
// guarantee they drift — the same reason the fieldRef marker is read in one
// validator rather than reimplemented per widget.
//
// The report surface's arguments/bindings model is what this lifts; see
// DashboardParameter's doc comment for what was carried across and what was
// deliberately left behind.
import type { FilterGroup, FilterCondition, CompareOp } from '@/features/workflows/types'
import type { DashboardParameter, ParameterBinding } from './schema'

/** Viewer-supplied values, keyed by parameter key. Values live in runtime
 *  state only — never written back into the dashboard, exactly like the
 *  chart toolbar's own live overrides. */
export type ParameterValues = Record<string, unknown>

/** A value that contributes nothing to a filter. An unset parameter must
 *  NARROW NOTHING rather than match nothing — the stance the report model
 *  already takes ("an unsupplied optional argument narrows nothing"), and
 *  the difference between a dashboard that opens showing everything and one
 *  that opens looking broken. */
function isUnset(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

/** The effective value of one parameter: what the viewer supplied, else its
 *  declared default, else unset. */
export function effectiveValue(param: DashboardParameter, values: ParameterValues): unknown {
  const supplied = values[param.key]
  return isUnset(supplied) ? param.default : supplied
}

/** Builds the extra filter one widget should apply, from every binding that
 *  targets it. Returns undefined when nothing applies, so a caller can hand
 *  it straight to mergeFilters.
 *
 *  A binding naming a parameter that no longer exists — or one whose value is
 *  unset — is SKIPPED, never an error. Dashboards outlive the parameters they
 *  were authored against, and failing a whole tile because one binding went
 *  stale would take out the dashboard rather than the binding. Same
 *  degrade-to-silence posture the widget lint and the field resolver take. */
export function resolveParameterFilter(
  widgetId: string,
  parameters: DashboardParameter[] | undefined,
  bindings: ParameterBinding[] | undefined,
  values: ParameterValues,
): FilterGroup | undefined {
  if (!parameters?.length || !bindings?.length) return undefined

  const byKey = new Map(parameters.map((p) => [p.key, p]))
  const conditions: FilterCondition[] = []

  for (const binding of bindings) {
    if (binding.widgetId !== widgetId) continue
    const param = byKey.get(binding.parameterKey)
    if (!param) continue

    const value = effectiveValue(param, values)
    if (isUnset(value)) continue

    conditions.push({
      // Deterministic rather than random, so re-rendering with the same
      // values produces an identical filter and does not invalidate the
      // data query's cache key on every keystroke.
      id: `param-${binding.parameterKey}-${binding.field}`,
      field: binding.field,
      op: (binding.op || 'eq') as CompareOp,
      value_mode: 'static',
      value: value as FilterCondition['value'],
    })
  }

  if (conditions.length === 0) return undefined
  return { combinator: 'and', conditions, groups: [] }
}

/** Every parameter that currently narrows something — what the runtime bar
 *  shows as active, and what a "clear" affordance would reset. */
export function activeParameterKeys(
  parameters: DashboardParameter[] | undefined,
  values: ParameterValues,
): string[] {
  return (parameters ?? [])
    .filter((p) => !isUnset(effectiveValue(p, values)))
    .map((p) => p.key)
}

// ---------------------------------------------------------------------------
// Authoring helpers — used by the builder panel, not by the runtime
// ---------------------------------------------------------------------------

/** One tile a parameter may be bound to: a widget that declared itself
 *  bindable AND has a form chosen. */
export interface BindableWidget {
  id: string
  /** The tile's own title, else its widget type — what the picker shows. */
  label: string
  formId: string
}

/** The tiles on this dashboard that a binding can target.
 *
 *  Asks each widget's registry entry rather than reading `config.formId`,
 *  because `config` is opaque to the dashboard core by contract — see
 *  `bindable` in widget-contract.ts. A widget type that never declared
 *  itself bindable is absent here however its config is shaped, and one
 *  that did but has no form chosen yet is absent until it does. */
export function bindableWidgets(
  widgets: Array<{ id: string; type: string; title?: string; config: unknown }>,
  lookup: (type: string) => { bindable?: { formId: (config: never) => string | undefined } } | undefined,
): BindableWidget[] {
  const out: BindableWidget[] = []
  for (const w of widgets) {
    const formId = lookup(w.type)?.bindable?.formId(w.config as never)
    if (formId) out.push({ id: w.id, label: w.title?.trim() || w.type, formId })
  }
  return out
}

/** A fresh parameter with a key that does not collide with an existing one.
 *  Mirrors the report surface's createArgument. */
export function createParameter(existing: DashboardParameter[] | undefined): DashboardParameter {
  const taken = new Set((existing ?? []).map((p) => p.key))
  let n = taken.size + 1
  while (taken.has(`param_${n}`)) n += 1
  return { key: `param_${n}`, label: `Parameter ${n}`, type: 'text' }
}

/** Operators worth offering for a parameter's type. A text parameter
 *  comparing with `gte` is legal but nearly always a mistake; a boolean
 *  only ever means equals.
 *
 *  Not the full CompareOp union on purpose — this is the authoring
 *  shortlist, and a binding hand-written by MCP may use anything the filter
 *  grammar accepts. */
export function operatorsFor(type: DashboardParameter['type']): CompareOp[] {
  switch (type) {
    case 'number':
    case 'date':
      return ['eq', 'neq', 'gte', 'lte', 'gt', 'lt']
    case 'boolean':
      return ['eq', 'neq']
    default:
      return ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in']
  }
}

/** Keeps a binding's operator legal after its parameter's type changes —
 *  a `contains` left behind on a date parameter would compile to a text
 *  comparison against a date column. */
export function coerceOperator(op: string | undefined, type: DashboardParameter['type']): CompareOp {
  const allowed = operatorsFor(type)
  return allowed.includes((op ?? '') as CompareOp) ? (op as CompareOp) : allowed[0]
}
