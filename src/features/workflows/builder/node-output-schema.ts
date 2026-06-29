// Describes what each workflow node publishes to downstream nodes, so the
// expression editor can browse/autocomplete upstream outputs.
//
// Addressing is the REAL Expr syntax the engine evaluates at runtime:
//   NodeOutputs["<nodeId>"]["records"][0]["email"]
// The friendly node label is shown in the UI; the inserted text is the path.

import type { FlowNode } from './store'
import type { NodeType, FetchRecordsConfig, SetVariableConfig } from '../types'
import type { FormDefinition, FieldDef, FieldType } from '@/features/forms/types'

/** A field exposed by a node output. Objects/arrays carry `children`. */
export interface OutputField {
  key: string
  type: string
  /** True when this field is an array; leaves address element 0 (`[0]`). */
  isArray?: boolean
  children?: OutputField[]
}

/** The output schema of a single (upstream) node. */
export interface NodeOutputSchema {
  nodeId: string
  nodeLabel: string
  nodeType: NodeType
  fields: OutputField[]
}

// Map a backend form FieldType to a display type for the browser badges.
const FIELD_TYPE_DISPLAY: Record<string, string> = {
  string: 'string', text: 'string', email: 'string', phone: 'string',
  integer: 'integer', decimal: 'float',
  boolean: 'boolean', date: 'datetime', time: 'time', datetime: 'datetime',
  json: 'object', file: 'object', enum: 'string', reference: 'string',
}

export function fieldTypeToDisplay(t: FieldType | string): string {
  return FIELD_TYPE_DISPLAY[t] ?? 'string'
}

// The audit columns every form record carries plus its user fields.
function recordFields(form: FormDefinition | undefined): OutputField[] {
  const audit: OutputField[] = [
    { key: 'id', type: 'string' },
    { key: 'created_at', type: 'datetime' },
    { key: 'updated_at', type: 'datetime' },
  ]
  const fields = (form?.fields ?? []).map((f: FieldDef) => ({
    key: f.name,
    type: fieldTypeToDisplay(f.type),
  }))
  return [...fields, ...audit]
}

/**
 * Builds the output schema for one node. `formsById` (from the cached forms
 * list) lets a Fetch Records node expose its record's real field keys; when the
 * form is unknown the structural keys (records/count/first) are still exposed
 * and dynamic field access remains possible at runtime.
 */
export function buildNodeOutputSchema(
  node: FlowNode,
  formsById: Map<string, FormDefinition>,
): NodeOutputSchema | null {
  const { type } = node.data
  const label = node.data.label || type

  switch (type) {
    case 'fetch_records': {
      const cfg = node.data.configuration as FetchRecordsConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      const record = recordFields(form)
      return {
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'records', type: 'array', isArray: true, children: record },
          { key: 'count', type: 'integer' },
          { key: 'first', type: 'object', children: record },
        ],
      }
    }

    case 'set_variable': {
      // Outputs the variable names it assigned (NodeOutput = the change map).
      const cfg = node.data.configuration as SetVariableConfig | undefined
      const fields = (cfg?.assignments ?? [])
        .map((a) => a.variable_name)
        .filter(Boolean)
        .map((name) => ({ key: name, type: 'any' }))
      if (fields.length === 0) return null
      return { nodeId: node.id, nodeLabel: label, nodeType: type, fields }
    }

    case 'condition': {
      // ConditionActivity emits { expression, result, branch }.
      return {
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'result', type: 'boolean' },
          { key: 'branch', type: 'string' },
          { key: 'expression', type: 'string' },
        ],
      }
    }

    default:
      // entry/exit/merge/subflow publish nothing addressable yet.
      return null
  }
}

/** The Expr path that addresses an output field on a node. */
export function outputFieldPath(nodeId: string, path: OutputField[]): string {
  let expr = `NodeOutputs["${nodeId}"]`
  for (const f of path) {
    expr += `["${f.key}"]`
    if (f.isArray) expr += '[0]'
  }
  return expr
}
