// Describes what each workflow node publishes to downstream nodes, so the
// expression editor can browse/autocomplete upstream outputs.
//
// Addressing is the REAL Expr syntax the engine evaluates at runtime:
//   NodeOutputs["<nodeId>"]["records"][0]["email"]
// The friendly node label is shown in the UI; the inserted text is the path.

import type { FlowNode } from './store'
import type { NodeType, FetchRecordsConfig, SetVariableConfig, IteratorConfig } from '../types'
import type { FormDefinition, FieldDef, FieldType } from '@/features/forms/types'

/** A field exposed by a node output. Objects/arrays carry `children`. */
export interface OutputField {
  key: string
  /** Human-readable display name (the form field's label). Falls back to `key`
   *  in the UI when absent. The inserted Expr path always uses `key`. */
  label?: string
  type: string
  /** True when this field is an array; leaves address element 0 (`[0]`). */
  isArray?: boolean
  children?: OutputField[]
}

/** How an output schema's fields are addressed in an expression.
 *  - 'node_outputs' → NodeOutputs["<nodeId>"]["field"] (default, real node output)
 *  - 'vars'         → Vars["field"] (loop-scoped variables like item/index) */
export type SchemaRoot = 'node_outputs' | 'vars'

/** The output schema of a single (upstream) node. */
export interface NodeOutputSchema {
  nodeId: string
  nodeLabel: string
  nodeType: NodeType
  fields: OutputField[]
  /** Addressing root for this schema's fields. Defaults to 'node_outputs'. */
  root?: SchemaRoot
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

// The audit columns every form record carries plus its user fields. Each field
// carries the human-readable `label` for display; the `key` is what the Expr
// path addresses.
function recordFields(form: FormDefinition | undefined): OutputField[] {
  const audit: OutputField[] = [
    { key: 'id', label: 'ID', type: 'string' },
    { key: 'created_at', label: 'Created At', type: 'datetime' },
    { key: 'updated_at', label: 'Updated At', type: 'datetime' },
  ]
  const fields = (form?.fields ?? []).map((f: FieldDef) => ({
    key: f.name,
    label: f.label || f.name,
    type: fieldTypeToDisplay(f.type),
  }))
  return [...fields, ...audit]
}

// Matches a source expression that points at a fetch node's collection, e.g.
//   NodeOutputs["fetch1"]["records"]   or   NodeOutputs["fetch1"]["first"]
const FETCH_SOURCE_RE = /NodeOutputs\s*\[\s*"([^"]+)"\s*\]\s*\[\s*"(records|first)"\s*\]/

/**
 * Infers the per-element field shape of an iterator's source list. When the
 * source is a Fetch Records node's `records`/`first`, returns that form's record
 * fields so the loop item exposes real keys for autocomplete; otherwise returns
 * undefined (the item stays a generic object with dynamic access).
 */
export function inferItemFields(
  sourceExpr: string | undefined,
  nodes: FlowNode[],
  formsById: Map<string, FormDefinition>,
): OutputField[] | undefined {
  if (!sourceExpr) return undefined
  const m = FETCH_SOURCE_RE.exec(sourceExpr)
  if (!m) return undefined
  const sourceNode = nodes.find((n) => n.id === m[1])
  if (!sourceNode || sourceNode.data.type !== 'fetch_records') return undefined
  const cfg = sourceNode.data.configuration as FetchRecordsConfig | undefined
  const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
  if (!form) return undefined
  return recordFields(form)
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
  nodes: FlowNode[] = [],
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

    case 'iterator': {
      // Downstream of Loop End, the iterator publishes its last processed
      // element + count/index to the execution context (NodeOutputs[iter]).
      // (Inside the body, the current element is Vars["item"] — see
      // iteratorItemSchema.) Item fields are inferred from the source list when
      // possible so autocomplete shows real keys.
      const cfg = node.data.configuration as IteratorConfig | undefined
      const itemChildren = inferItemFields(cfg?.source_expr, nodes, formsById)
      return {
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'item', type: 'object', children: itemChildren },
          { key: 'index', type: 'integer' },
          { key: 'count', type: 'integer' },
        ],
      }
    }

    default:
      // entry/exit/merge/loop_end/subflow publish nothing addressable yet.
      return null
  }
}

/** The Expr path that addresses an output field. For 'node_outputs' (default)
 *  the path is NodeOutputs["<nodeId>"]["a"]["b"]; for 'vars' (loop item/index)
 *  it is Vars["a"]["b"] (the nodeId is ignored). */
export function outputFieldPath(nodeId: string, path: OutputField[], root: SchemaRoot = 'node_outputs'): string {
  let expr = root === 'vars' ? 'Vars' : `NodeOutputs["${nodeId}"]`
  for (const f of path) {
    expr += `["${f.key}"]`
    if (f.isArray) expr += '[0]'
  }
  return expr
}

/** Builds the loop-scoped item/index schema an iterator exposes to its body.
 *  Item fields are inferred from the source list when possible (so autocomplete
 *  under Vars["item"] shows the element's real keys). */
export function iteratorItemSchema(
  node: FlowNode,
  nodes: FlowNode[],
  formsById: Map<string, FormDefinition>,
): NodeOutputSchema {
  const cfg = node.data.configuration as IteratorConfig | undefined
  const itemVar = cfg?.item_var || 'item'
  const indexVar = cfg?.index_var || 'index'
  const itemChildren = inferItemFields(cfg?.source_expr, nodes, formsById)
  return {
    nodeId: node.id,
    nodeLabel: `${node.data.label || 'Iterator'} (loop item)`,
    nodeType: 'iterator',
    root: 'vars',
    fields: [
      { key: itemVar, type: 'object', children: itemChildren },
      { key: indexVar, type: 'integer' },
    ],
  }
}
