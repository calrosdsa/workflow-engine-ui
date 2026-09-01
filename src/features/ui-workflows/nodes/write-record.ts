import { FilePlus2, PencilLine } from 'lucide-react'
import { registerUiWorkflowNode } from '../node-registry'
import { buildRecordValues } from '../values'
import { ALL_PLATFORMS } from '../types'

/** One field write. `source` mirrors set_variable's: a literal, or the value
 *  of a run variable. No expression mode, for the same reason — Expr has no
 *  client evaluator, so an expression would cost a round-trip per field. */
export interface RecordFieldWrite {
  field: string
  source: 'static' | 'variable'
  value?: unknown
  variable?: string
}

export interface WriteRecordStepConfig {
  form_id: string
  values: RecordFieldWrite[]
  /** create only: run variable the new record's id is stored in, so a later
   *  navigate/update step can address what this one just made. */
  output_variable?: string
  /** update only: run variable holding the id of the record to update. */
  record_id_variable?: string
}

function parseWrites(raw: unknown): RecordFieldWrite[] {
  if (!Array.isArray(raw)) return []
  const out: RecordFieldWrite[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as Record<string, unknown>
    if (typeof r.field !== 'string' || !r.field) continue
    out.push({
      field: r.field,
      source: r.source === 'variable' ? 'variable' : 'static',
      value: 'value' in r ? r.value : undefined,
      variable: typeof r.variable === 'string' ? r.variable : undefined,
    })
  }
  return out
}

export function emptyWriteRecordConfig(): WriteRecordStepConfig {
  return { form_id: '', values: [] }
}

export function parseWriteRecordConfig(raw: unknown): WriteRecordStepConfig {
  const empty = emptyWriteRecordConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    form_id: typeof r.form_id === 'string' ? r.form_id : empty.form_id,
    values: parseWrites(r.values),
    output_variable: typeof r.output_variable === 'string' ? r.output_variable : undefined,
    record_id_variable:
      typeof r.record_id_variable === 'string' ? r.record_id_variable : undefined,
  }
}

// Both writes go through the ORDINARY record endpoints as the viewer, so field
// validation, the form's own Before/After triggers, per-form permissions and
// the audit log all apply exactly as they would if the person had typed the
// values in by hand. That is the property that makes client-authored writes
// safe to ship at all, and it is why there is no batch equivalent here: the
// server's upsert_records/save_records exist to move volume under a service
// identity, which a client must never have.

registerUiWorkflowNode({
  type: 'create_record',
  label: 'Create Record',
  icon: FilePlus2,
  description: 'Creates one record on a form, as the current viewer.',
  category: 'data',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      "Creates a single record through the ordinary create endpoint — the viewer's own permissions, the form's validation, its triggers and the audit log all apply. Single-record only; there is deliberately no batch write on the client.",
    required: ['form_id', 'values'],
    properties: {
      form_id: { type: 'string', description: 'Form to create the record on.' },
      values: {
        type: 'array',
        description: 'Field writes: {field, source: static|variable, value, variable}.',
      },
      output_variable: {
        type: 'string',
        description: "Run variable the new record's id is stored in.",
      },
    },
  },
  execute: async ({ config, ctx, host }) => {
    if (!config.form_id) throw new Error('This step has no form configured.')
    const created = await host.createRecord(config.form_id, buildRecordValues(config.values, ctx))
    // Storing the id is what makes "create it, then open it" expressible at
    // all — navigate's record_id_variable reads exactly this.
    if (config.output_variable) ctx.variables[config.output_variable] = created.id
    return { kind: 'next' }
  },
  parseConfig: parseWriteRecordConfig,
  createDefaultConfig: emptyWriteRecordConfig,
})

registerUiWorkflowNode({
  type: 'update_record',
  label: 'Update Record',
  icon: PencilLine,
  description: 'Updates one record on a form, as the current viewer.',
  category: 'data',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Updates a single record through the ordinary update endpoint. Sends only the listed fields — that endpoint is a genuine partial patch.',
    required: ['form_id', 'values'],
    properties: {
      form_id: { type: 'string', description: 'Form the record belongs to.' },
      values: {
        type: 'array',
        description: 'Field writes: {field, source: static|variable, value, variable}.',
      },
      record_id_variable: {
        type: 'string',
        description:
          'Run variable holding the id of the record to update. Absent means the record the workflow was triggered on.',
      },
    },
  },
  execute: async ({ config, ctx, host }) => {
    const formId = config.form_id || ctx.formId
    const recordId = config.record_id_variable
      ? String(ctx.variables[config.record_id_variable] ?? '')
      : ctx.recordId
    if (!formId) throw new Error('This step has no form configured.')
    if (!recordId) {
      throw new Error(
        config.record_id_variable
          ? `Nothing to update: variable "${config.record_id_variable}" holds no record id.`
          : 'Nothing to update: no record is in context for this step.',
      )
    }

    const values = buildRecordValues(config.values, ctx)
    // Sends ONLY the configured fields. The endpoint is a genuine partial
    // patch, and resubmitting a whole fetched record is what broke Kanban's
    // cross-column drag: a date field round-trips from GET as full RFC3339
    // while the validator demands YYYY-MM-DD on write.
    if (Object.keys(values).length === 0) return { kind: 'next' }
    await host.updateRecord(formId, recordId, values)
    return { kind: 'next' }
  },
  parseConfig: parseWriteRecordConfig,
  createDefaultConfig: emptyWriteRecordConfig,
})
