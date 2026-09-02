// Resolving a configured value against a live run.
//
// Several nodes take "a value" that is either a literal, a run variable, or a
// field off the triggering record. That is deliberately the WHOLE vocabulary:
// there is no expression mode anywhere in a UI workflow, because Expr is a Go
// library with no client evaluator, so an expression would cost a network
// round-trip per value — the same reason conditions are structured trees.
import type { UiWorkflowRunContext } from './host'

export type ValueSource = 'static' | 'variable' | 'field'

export interface ValueRef {
  source: ValueSource
  value?: unknown
  variable?: string
  field?: string
}

/** Resolves one configured value. Returns undefined for a reference that
 *  names something absent — a variable never set, a field the record doesn't
 *  carry — rather than throwing or substituting a placeholder: undefined is
 *  what "no value" already means everywhere this feeds into. */
export function resolveValue(ref: ValueRef, ctx: UiWorkflowRunContext): unknown {
  switch (ref.source) {
    case 'variable':
      return ref.variable ? ctx.variables[ref.variable] : undefined
    case 'field':
      return ref.field ? ctx.record[ref.field] : undefined
    case 'static':
    default:
      return ref.value
  }
}

/** Builds the record body for a create/update step. Skips entries with no
 *  field name; keeps resolved undefined values OUT of the body entirely
 *  rather than sending null, because the update endpoint is a genuine partial
 *  patch — a key present with undefined would be an explicit "clear this",
 *  which is not what an unresolved reference means. */
export function buildRecordValues(
  writes: readonly (ValueRef & { field: string })[] | undefined,
  ctx: UiWorkflowRunContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  // Nullable because an executor may receive an unparsed config — see
  // open-form's own note. An absent list means no writes, not a crash.
  for (const write of writes ?? []) {
    if (!write.field) continue
    const value = resolveValue(write, ctx)
    if (value === undefined) continue
    out[write.field] = value
  }
  return out
}

/** What a `condition` step evaluates against: the triggering record's fields
 *  with the run's variables layered on top.
 *
 *  Variables win on a name collision. A variable is something this run
 *  explicitly computed a moment ago, so treating it as the more specific
 *  answer is the least surprising rule — and the alternative (record wins)
 *  would make a set_variable step silently ineffective whenever it happened
 *  to share a field's name. */
export function conditionValues(ctx: UiWorkflowRunContext): Record<string, unknown> {
  return { ...ctx.record, ...ctx.variables }
}
