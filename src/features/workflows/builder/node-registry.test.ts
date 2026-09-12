import { describe, it, expect } from 'vitest'
import { normaliseTriggerConfig } from './node-forms/TriggerForm'
import { normaliseShowMessageConfig } from './node-forms/ShowMessageForm'
import { normaliseSetVariableConfig } from './node-forms/SetVariableForm'
import { normaliseFetchRecordsConfig } from './node-forms/FetchRecordsForm'
import { normaliseUpsertRecordsConfig } from './node-forms/UpsertRecordsForm'
import { normaliseUpdateRecordsConfig } from './node-forms/UpdateRecordsForm'
import { normaliseDeleteRecordsConfig } from './node-forms/DeleteRecordsForm'
import { normaliseTransformConfig } from './node-forms/TransformForm'
import { normaliseSaveRecordsConfig } from './node-forms/SaveRecordsForm'
import { normaliseHttpRequestConfig } from './node-forms/HttpRequestForm'
import { normaliseDebugConfig } from './node-forms/DebugForm'
import { normaliseSubflowConfig } from './node-forms/SubflowForm'

// Each normalise*Config function is pure — (raw: unknown) => Config — with no
// React/Zustand dependency, so it's cheap to unit-test in isolation the same
// way the builder-kit tree-store core is (see features/builder-kit/
// tree-store.test.ts). Coverage here is for the 12 types with a REAL
// normalizer; condition/iterator use identity normalise (nothing to assert
// beyond "returns its input", not worth a dedicated test).

describe('normaliseTriggerConfig', () => {
  it('fills in every default for an empty/undefined raw config', () => {
    expect(normaliseTriggerConfig(undefined)).toEqual({
      mode: 'on_demand', cron: '', timezone: '', description: '',
      form_id: '', event_type: 'create_or_update',
      filter: { id: expect.any(String), combinator: 'and', conditions: [], groups: [] },
      source_form_id: '',
      webhook_token: '',
      // webhook_provider/webhook_events/webhook_secret_credential — Phase
      // 2(b) step 5's provider select/events multiselect/secret fields.
      // Same "toEqual compares the whole object" trap the Expose-as-Tool
      // comment below already notes.
      webhook_provider: '',
      webhook_events: [],
      webhook_secret_credential: '',
      // webhook_preset — trigger-preset feature's own cosmetic marker, see
      // TriggerConfig's own doc comment.
      webhook_preset: '',
      source_definition_id: '',
      enabled: true,
      // Expose-as-Tool defaults (FR-C8-004) — this expectation went stale when
      // normaliseTriggerConfig gained them, since toEqual compares the whole
      // object and the four new keys were never added here.
      expose_as_tool: false,
      tool_name: '',
      tool_description: '',
      tool_parameters: [],
    })
  })

  it('preserves a well-formed partial config and re-attaches filter ids', () => {
    const result = normaliseTriggerConfig({
      mode: 'scheduled', cron: '0 9 * * *',
      filter: { combinator: 'or', conditions: [{ field: 'status' }], groups: [] },
    })
    expect(result.mode).toBe('scheduled')
    expect(result.cron).toBe('0 9 * * *')
    expect(result.enabled).toBe(true) // still defaults even though other fields were provided
    expect(result.filter?.id).toEqual(expect.any(String))
    expect(result.filter?.conditions[0].id).toEqual(expect.any(String))
  })
})

describe('normaliseShowMessageConfig', () => {
  it('defaults to an info message with no timeout', () => {
    expect(normaliseShowMessageConfig(null)).toEqual({
      message: '', is_html: false, timeout_ms: 0, message_type: 'info',
    })
  })

  it('preserves provided fields', () => {
    expect(normaliseShowMessageConfig({ message: 'Done', message_type: 'success', is_html: true }))
      .toEqual({ message: 'Done', is_html: true, timeout_ms: 0, message_type: 'success' })
  })
})

describe('normaliseSetVariableConfig', () => {
  it('defaults to an empty assignment list', () => {
    expect(normaliseSetVariableConfig(undefined)).toEqual({ assignments: [] })
  })

  it('passes through the current multi-assignment shape unchanged', () => {
    const cfg = { assignments: [{ id: 'a1', variable_name: 'x', mode: 'literal', literal_value: 1, expression: '' }] }
    expect(normaliseSetVariableConfig(cfg)).toBe(cfg) // same reference — no cloning needed for the current shape
  })

  it('upgrades the legacy single-assignment shape into one assignment', () => {
    const result = normaliseSetVariableConfig({ variable_name: 'count', mode: 'expression', expression: 'Vars["count"] + 1' })
    expect(result.assignments).toHaveLength(1)
    expect(result.assignments[0]).toMatchObject({
      variable_name: 'count', mode: 'expression', expression: 'Vars["count"] + 1',
    })
    expect(result.assignments[0].id).toEqual(expect.any(String))
  })
})

describe('normaliseFetchRecordsConfig', () => {
  it('defaults mode to many and limit/output_var to empty', () => {
    const result = normaliseFetchRecordsConfig({})
    expect(result.mode).toBe('many')
    expect(result.limit).toBe(0)
    expect(result.output_var).toBe('')
    expect(result.count_var).toBe('')
    expect(result.filter).toEqual({ id: expect.any(String), combinator: 'and', conditions: [], groups: [] })
  })

  it('re-attaches ids to sort rules missing one', () => {
    const result = normaliseFetchRecordsConfig({ sort: [{ field: 'name', dir: 'asc' }] })
    expect(result.sort[0].id).toEqual(expect.any(String))
    expect(result.sort[0].field).toBe('name')
  })
})

describe('normaliseUpsertRecordsConfig', () => {
  it('defaults to an empty values list', () => {
    expect(normaliseUpsertRecordsConfig({})).toEqual({ form_id: '', values: [], output_var: '' })
  })

  it('re-attaches ids to values missing one', () => {
    const result = normaliseUpsertRecordsConfig({ form_id: 'f1', values: [{ field: 'email', value_mode: 'static', value: 'a@b.com' }] })
    expect(result.values[0].id).toEqual(expect.any(String))
  })
})

describe('normaliseUpdateRecordsConfig', () => {
  it('defaults mode to one and re-attaches filter/value ids', () => {
    const result = normaliseUpdateRecordsConfig({ values: [{ field: 'status' }] })
    expect(result.mode).toBe('one')
    expect(result.filter?.id).toEqual(expect.any(String))
    expect(result.values[0].id).toEqual(expect.any(String))
  })
})

describe('normaliseDeleteRecordsConfig', () => {
  it('defaults mode to one and re-attaches filter ids', () => {
    const result = normaliseDeleteRecordsConfig({})
    expect(result.mode).toBe('one')
    expect(result.filter).toEqual({ id: expect.any(String), combinator: 'and', conditions: [], groups: [] })
    expect(result.count_var).toBe('')
  })
})

describe('normaliseTransformConfig', () => {
  it('defaults to an empty mappings list', () => {
    expect(normaliseTransformConfig({})).toEqual({ source_expr: '', form_id: '', mappings: [], output_var: '' })
  })

  it('re-attaches ids to mappings missing one', () => {
    const result = normaliseTransformConfig({ mappings: [{ field: 'name', value_mode: 'static', value: 'x' }] })
    expect(result.mappings[0].id).toEqual(expect.any(String))
  })
})

describe('normaliseSaveRecordsConfig', () => {
  it('fills in every default for an empty raw config', () => {
    expect(normaliseSaveRecordsConfig(undefined)).toEqual({
      source_expr: '', form_id: '', output_var: '', count_var: '',
    })
  })
})

describe('normaliseHttpRequestConfig', () => {
  it('defaults method to GET and every mode field to static/none', () => {
    const result = normaliseHttpRequestConfig({})
    expect(result.method).toBe('GET')
    expect(result.url_mode).toBe('static')
    expect(result.body_mode).toBe('none')
    expect(result.auth_type).toBe('none')
    expect(result.params).toEqual([])
    expect(result.headers).toEqual([])
  })

  it('re-attaches ids to params/headers/response_schemas missing one', () => {
    const result = normaliseHttpRequestConfig({
      params: [{ key: 'q', value: '1' }],
      response_schemas: [{ name: 'Users', kind: 'list', source: 'body', fields: [{ path: 'id', type: 'string', name: 'Id' }] }],
    })
    expect(result.params[0].id).toEqual(expect.any(String))
    // normaliseHttpRequestConfig always populates response_schemas via
    // ensureResponseSchemaIds (defaults to []), never leaves it undefined.
    expect(result.response_schemas![0].id).toEqual(expect.any(String))
    expect(result.response_schemas![0].fields[0].id).toEqual(expect.any(String))
  })
})

describe('normaliseDebugConfig', () => {
  it('defaults label to empty and watches to an empty list', () => {
    expect(normaliseDebugConfig(undefined)).toEqual({ label: '', watches: [] })
  })

  it('preserves the legacy label-only shape (no watches field at all)', () => {
    expect(normaliseDebugConfig({ label: 'after fetch' })).toEqual({ label: 'after fetch', watches: [] })
  })

  it('re-attaches ids to watches missing one', () => {
    const result = normaliseDebugConfig({ watches: [{ name: 'total', expression: 'Vars["x"] + 1' }] })
    expect(result.watches![0].id).toEqual(expect.any(String))
    expect(result.watches![0].name).toBe('total')
    expect(result.watches![0].expression).toBe('Vars["x"] + 1')
  })
})

describe('normaliseSubflowConfig', () => {
  it('fills in every default for an empty/undefined raw config', () => {
    const result = normaliseSubflowConfig(undefined)
    expect(result.definition_id).toBe('')
    expect(result.sync).toBe(true)
    expect(result.input_mappings).toEqual([])
    expect(result.output_mappings).toEqual([])
  })

  it('preserves a well-formed config and re-attaches mapping ids', () => {
    const result = normaliseSubflowConfig({
      definition_id: 'def-1',
      sync: false,
      input_mappings: [{ variable_name: 'amount', mode: 'literal', literal_value: 42 }],
      output_mappings: [{ source_variable: 'result', target_variable: 'callerResult' }],
    })
    expect(result.definition_id).toBe('def-1')
    expect(result.sync).toBe(false)
    expect(result.input_mappings).toHaveLength(1)
    expect(result.input_mappings![0]).toMatchObject({ variable_name: 'amount', mode: 'literal', literal_value: 42 })
    expect(result.input_mappings![0].id).toEqual(expect.any(String))
    expect(result.output_mappings).toHaveLength(1)
    expect(result.output_mappings![0]).toMatchObject({ source_variable: 'result', target_variable: 'callerResult' })
    expect(result.output_mappings![0].id).toEqual(expect.any(String))
  })

  it('preserves an existing mapping id rather than replacing it', () => {
    const result = normaliseSubflowConfig({
      definition_id: 'def-1',
      input_mappings: [{ id: 'existing-id', variable_name: 'x', mode: 'literal', literal_value: 1 }],
    })
    expect(result.input_mappings![0].id).toBe('existing-id')
  })

  it('upgrades the legacy definition_id-only shape (no mappings at all)', () => {
    const result = normaliseSubflowConfig({ definition_id: 'def-legacy' })
    expect(result.definition_id).toBe('def-legacy')
    expect(result.sync).toBe(true)
    expect(result.input_mappings).toEqual([])
    expect(result.output_mappings).toEqual([])
  })
})
