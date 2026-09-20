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
