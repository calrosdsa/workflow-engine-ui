import type { ExportFormat, ReportArgument } from '@/features/reports/types'

/** How one report argument gets its value when this action runs
 *  (FR-D2-019 RUN-06).
 *
 *  - `current_record` binds it to the record the action was invoked on, with
 *    no dialog — the intended default path, since an invoice's export should
 *    not ask which invoice.
 *  - `prompt` asks the person at click time. This is also how "let me pick a
 *    different record" is expressed.
 *  - `skip` leaves the argument unsupplied, so its filter is omitted entirely
 *    (the engine's ARG-R-07 rule) and the action stays one click. Only legal
 *    for an OPTIONAL argument — a required one has nothing to fall back on.
 *
 *  `skip` exists because the other two modes alone cannot express "this report
 *  has an optional input I don't care about here." Without it, honouring
 *  `prompt` would force a dialog on every action whose report declares any
 *  optional argument, and the only alternative — quietly not asking — makes
 *  the author's own "Ask the person" choice a lie.
 */
export type ArgumentMode = 'current_record' | 'prompt' | 'skip'

export interface ExportReportActionConfig {
  reportDefinitionId: string
  format: ExportFormat | ''
  /** Per-argument mode, keyed by argument key. An argument with no entry
   *  falls back to `prompt`, which is the safe default: asking is always
   *  valid, whereas current_record is only valid for a reference argument
   *  targeting this very form. */
  argumentModes?: Record<string, ArgumentMode>
}

export function emptyExportReportActionConfig(): ExportReportActionConfig {
  return { reportDefinitionId: '', format: '' }
}

/** Defensive parse — mirrors trigger_workflow's parseTriggerWorkflowActionConfig
 *  and DetailTabDefinition.parseConfig's shared "never throw, heal a
 *  malformed/stale blob" contract. */
export function parseExportReportActionConfig(raw: unknown): ExportReportActionConfig {
  const empty = emptyExportReportActionConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    reportDefinitionId: typeof r.reportDefinitionId === 'string' ? r.reportDefinitionId : empty.reportDefinitionId,
    format: typeof r.format === 'string' ? (r.format as ExportFormat) : empty.format,
    argumentModes: parseArgumentModes(r.argumentModes),
  }
}

function parseArgumentModes(raw: unknown): Record<string, ArgumentMode> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, ArgumentMode> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'current_record' || value === 'prompt' || value === 'skip') out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Whether `current_record` is a legal mode for this argument on this form.
 *
 * It only means something when the argument names a record on the very form
 * the action is attached to — a date argument cannot be "the current record",
 * and a reference to some OTHER form would silently pass a mismatched id that
 * returns zero rows and looks like missing data rather than misconfiguration.
 * Offering the mode in those cases would let an author save a configuration
 * that can only fail at click time.
 */
export function supportsCurrentRecord(argument: ReportArgument, formId: string): boolean {
  return argument.type === 'reference' && !!argument.form_id && argument.form_id === formId
}

/** The mode actually in force, applying both the stored choice and the
 *  compatibility rule — a stored `current_record` that is no longer valid
 *  (the report's argument changed type after the action was configured)
 *  degrades to `prompt` rather than sending a bad value. */
export function effectiveArgumentMode(
  argument: ReportArgument,
  config: ExportReportActionConfig,
  formId: string,
): ArgumentMode {
  const stored = config.argumentModes?.[argument.key]
  if (stored === 'current_record' && supportsCurrentRecord(argument, formId)) return 'current_record'
  // Same degrade-rather-than-fail rule as above: a stored `skip` on an
  // argument the report has since made REQUIRED would leave the run with no
  // value at all, so it falls back to asking.
  if (stored === 'skip' && !argument.required) return 'skip'
  return 'prompt'
}

/** Splits a report's arguments into the ones this action can fill by itself
 *  and the ones a person must be asked about. */
export function partitionArguments(
  argumentList: ReportArgument[],
  config: ExportReportActionConfig,
  formId: string,
  recordId: string,
): { resolved: Record<string, unknown>; toPrompt: ReportArgument[] } {
  const resolved: Record<string, unknown> = {}
  const toPrompt: ReportArgument[] = []

  for (const argument of argumentList) {
    switch (effectiveArgumentMode(argument, config, formId)) {
      case 'current_record':
        resolved[argument.key] = recordId
        break
      // Deliberately absent from BOTH lists: the engine treats an unsupplied
      // optional argument as "omit this filter", which is not the same as
      // supplying an empty value (that would match nothing).
      case 'skip':
        break
      default:
        toPrompt.push(argument)
    }
  }
  return { resolved, toPrompt }
}
