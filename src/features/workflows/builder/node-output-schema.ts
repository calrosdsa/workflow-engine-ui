// Describes what each workflow node publishes to downstream nodes, so the
// expression editor can browse/autocomplete upstream outputs.
//
// Addressing is the REAL Expr syntax the engine evaluates at runtime:
//   NodeOutputs["<nodeId>"]["records"][0]["email"]
// The friendly node label is shown in the UI; the inserted text is the path.

import type { FlowNode } from './store'
import type {
  NodeType, FetchRecordsConfig, SetVariableConfig, IteratorConfig,
  UpsertRecordsConfig, UpdateRecordsConfig, HttpRequestConfig, ResponseSchema, ResponseSchemaField,
  TriggerConfig, TransformConfig, SaveRecordsConfig,
} from '../types'
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
  /** When set, overrides the generic bracket-chain derivation in
   *  outputFieldPath() with this exact, precomputed Expr string. Used by
   *  HTTP response schema-mapped fields, whose row sits under an extra
   *  NodeOutputs[id][schemaName]([0])-indirection the generic chain
   *  (which always starts at NodeOutputs[nodeId]) can't express on its own. */
  exprPath?: string
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

// Matches a source expression that points at a fetch or transform node's
// collection, e.g. NodeOutputs["fetch1"]["records"] or
// NodeOutputs["transform1"]["records"] — both fetch_records and transform
// publish the same {records, count, [first]} shape, so one regex covers both;
// inferItemFields disambiguates by the matched node's actual type.
const FETCH_SOURCE_RE = /NodeOutputs\s*\[\s*"([^"]+)"\s*\]\s*\[\s*"(records|first)"\s*\]/

// Matches a source expression that points at an http_request node's named
// response-schema output, e.g. NodeOutputs["http1"]["Users"]. Distinguished
// from FETCH_SOURCE_RE by the node's type + a matching response_schemas
// entry (checked in inferItemFields), not by the key name itself — a schema
// can be named anything.
const HTTP_SCHEMA_SOURCE_RE = /NodeOutputs\s*\[\s*"([^"]+)"\s*\]\s*\[\s*"([^"]+)"\s*\]/

/** Turns a schema's declared fields into a FLAT OutputField list, one per
 *  field, keyed by its declared NAME (e.g. "City"), never by its source
 *  JSONPath segments (e.g. "address.city"). This matches the real runtime
 *  shape exactly: HTTPRequestActivity's extractSchemaRow (internal/
 *  activities/http_request.go) always assembles a row as
 *  row[f.Name] = extractedValue — completely flat, regardless of how deep
 *  the source path was. A field's dotted path is only ever a SOURCE lookup
 *  into the original response, never a shape the extracted row mirrors — so
 *  "address.city" named "City" shows up as one flat "City" field, not a
 *  nested address.city.
 *
 *  `exprPathPrefix`, when given, makes every field carry a precomputed
 *  `exprPath` rooted at that prefix (`${prefix}["<name>"]`) — needed for the
 *  http_request sibling-entry case (buildNodeOutputSchema), since only the
 *  top-level schema field otherwise knows about the
 *  NodeOutputs[id][schemaName][0] indirection. Omitted for the
 *  iterator-loop-item case (iteratorItemSchema), where the item is already
 *  one row — Vars["item"]["City"]'s generic derivation is already correct
 *  with no indirection to bridge. */
function schemaFieldsFlat(fields: ResponseSchemaField[], exprPathPrefix?: string): OutputField[] {
  return fields
    .filter((f) => f.name && f.path)
    .map((f) => ({
      key: f.name,
      label: f.name,
      type: f.type,
      ...(exprPathPrefix !== undefined ? { exprPath: `${exprPathPrefix}["${f.name}"]` } : {}),
    }))
}

/**
 * Infers the per-element field shape of an iterator's source list. Recognizes
 * two sources: a Fetch Records node's `records`/`first` (returns that form's
 * record fields), or an http_request node's named `list`-kind response schema
 * (returns that schema's declared fields, flat — see schemaFieldsFlat).
 * Returns undefined for anything else — the item stays a generic object with
 * dynamic access.
 */
export function inferItemFields(
  sourceExpr: string | undefined,
  nodes: FlowNode[],
  formsById: Map<string, FormDefinition>,
): OutputField[] | undefined {
  if (!sourceExpr) return undefined

  const fetchMatch = FETCH_SOURCE_RE.exec(sourceExpr)
  if (fetchMatch) {
    const sourceNode = nodes.find((n) => n.id === fetchMatch[1])
    if (sourceNode?.data.type === 'fetch_records') {
      const cfg = sourceNode.data.configuration as FetchRecordsConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      if (form) return recordFields(form)
    }
    if (sourceNode?.data.type === 'transform') {
      const cfg = sourceNode.data.configuration as TransformConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      if (form) return recordFields(form)
    }
  }

  const httpMatch = HTTP_SCHEMA_SOURCE_RE.exec(sourceExpr)
  if (httpMatch) {
    const sourceNode = nodes.find((n) => n.id === httpMatch[1])
    if (sourceNode?.data.type === 'http_request') {
      const cfg = sourceNode.data.configuration as HttpRequestConfig | undefined
      const schema = (cfg?.response_schemas ?? []).find((s) => s.name === httpMatch[2] && s.kind === 'list')
      if (schema) return schemaFieldsFlat(schema.fields)
    }
  }

  return undefined
}

/**
 * Builds the output schema(s) for one node. `formsById` (from the cached forms
 * list) lets a Fetch Records node expose its record's real field keys; when the
 * form is unknown the structural keys (records/count/first) are still exposed
 * and dynamic field access remains possible at runtime.
 *
 * Returns an array since one node can contribute more than one browsable
 * context entry — e.g. an http_request node with named response schemas
 * contributes its base fields PLUS one sibling entry per declared schema (see
 * the 'http_request' case). Nodes with nothing addressable return [].
 */
export function buildNodeOutputSchema(
  node: FlowNode,
  formsById: Map<string, FormDefinition>,
  nodes: FlowNode[] = [],
): NodeOutputSchema[] {
  const { type } = node.data
  const label = node.data.label || type

  switch (type) {
    case 'fetch_records': {
      const cfg = node.data.configuration as FetchRecordsConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      const record = recordFields(form)
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'records', type: 'array', isArray: true, children: record },
          { key: 'count', type: 'integer' },
          { key: 'first', type: 'object', children: record },
        ],
      }]
    }

    case 'upsert_records': {
      const cfg = node.data.configuration as UpsertRecordsConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      const record = recordFields(form)
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'action', type: 'string' },
          { key: 'record', type: 'object', children: record },
        ],
      }]
    }

    case 'update_records': {
      const cfg = node.data.configuration as UpdateRecordsConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      const record = recordFields(form)
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'records', type: 'array', isArray: true, children: record },
          { key: 'count', type: 'integer' },
        ],
      }]
    }

    case 'delete_records': {
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'count', type: 'integer' },
        ],
      }]
    }

    case 'transform': {
      // TransformActivity's "records" is shaped to the TARGET form (form_id),
      // unlike fetch_records/http_request where the list shape comes from the
      // SOURCE — the mapped fields are exactly the target form's fields.
      const cfg = node.data.configuration as TransformConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      const record = recordFields(form)
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'records', type: 'array', isArray: true, children: record },
          { key: 'count', type: 'integer' },
        ],
      }]
    }

    case 'save_records': {
      const cfg = node.data.configuration as SaveRecordsConfig | undefined
      const form = cfg?.form_id ? formsById.get(cfg.form_id) : undefined
      const record = recordFields(form)
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'records', type: 'array', isArray: true, children: record },
          { key: 'created', type: 'integer' },
          { key: 'updated', type: 'integer' },
          { key: 'count', type: 'integer' },
        ],
      }]
    }

    case 'set_variable': {
      // Outputs the variable names it assigned (NodeOutput = the change map).
      const cfg = node.data.configuration as SetVariableConfig | undefined
      const fields = (cfg?.assignments ?? [])
        .map((a) => a.variable_name)
        .filter(Boolean)
        .map((name) => ({ key: name, type: 'any' }))
      if (fields.length === 0) return []
      return [{ nodeId: node.id, nodeLabel: label, nodeType: type, fields }]
    }

    case 'condition': {
      // ConditionActivity emits { expression, result, branch }.
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'result', type: 'boolean' },
          { key: 'branch', type: 'string' },
          { key: 'expression', type: 'string' },
        ],
      }]
    }

    case 'iterator': {
      // Downstream of Loop End, the iterator publishes its last processed
      // element + count/index to the execution context (NodeOutputs[iter]).
      // (Inside the body, the current element is Vars["item"] — see
      // iteratorItemSchema.) Item fields are inferred from the source list when
      // possible so autocomplete shows real keys.
      const cfg = node.data.configuration as IteratorConfig | undefined
      const itemChildren = inferItemFields(cfg?.source_expr, nodes, formsById)
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'item', type: 'object', children: itemChildren },
          { key: 'index', type: 'integer' },
          { key: 'count', type: 'integer' },
        ],
      }]
    }

    case 'http_request': {
      // Mirrors internal/activities/http_request.go's NodeOutput map exactly.
      const cfg = node.data.configuration as HttpRequestConfig | undefined
      const base: NodeOutputSchema = {
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'status_code', type: 'integer' },
          { key: 'status', type: 'string' },
          { key: 'headers', type: 'object' },
          { key: 'headers_all', type: 'object' },
          { key: 'body', type: 'any' },
          { key: 'body_text', type: 'string' },
          { key: 'ok', type: 'boolean' },
          { key: 'duration_ms', type: 'integer' },
        ],
      }

      // Named response schemas (see types.ts's ResponseSchema) each become
      // their own sibling context entry, so e.g. "Users" is browsable/clickable
      // directly — not nested three levels under HTTP Request → body → Users.
      // This mirrors iteratorItemSchema's synthetic-sibling-entry trick below.
      //
      // Each entry exposes ONE field — the schema itself — whose own exprPath
      // (compileSchemaPath) resolves to the real extracted array/object
      // (NodeOutputs[id][schemaName], published server-side by
      // HTTPRequestActivity), with `children` giving per-field browsing/
      // autocomplete one level down. A `list` schema is marked isArray so it
      // gets the same [ ] badge and [0]-preview convention as fetch_records'
      // `records`, and — critically — can be dropped directly into an
      // Iterator's source list the same way, with per-field autocomplete
      // inside the loop body via inferItemFields above.
      const schemaEntries: NodeOutputSchema[] = (cfg?.response_schemas ?? [])
        .filter((s) => s.name && s.fields.length > 0)
        .map((s) => ({
          nodeId: node.id,
          nodeLabel: `${label} → ${s.name}`,
          nodeType: type,
          fields: [{
            key: s.name,
            label: s.name,
            type: s.kind === 'list' ? 'array' : 'object',
            isArray: s.kind === 'list',
            exprPath: compileSchemaPath(node.id, s),
            children: schemaFieldsFlat(s.fields, compileSchemaRowPath(node.id, s)),
          }],
        }))

      return [base, ...schemaEntries]
    }

    case 'knowledge_retrieval': {
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'answer', type: 'string' },
          { key: 'context', type: 'string' },
          {
            key: 'chunks', type: 'array', isArray: true,
            children: [
              { key: 'content', type: 'string' },
              { key: 'file_path', type: 'string' },
              { key: 'reference_id', type: 'integer' },
            ],
          },
          {
            key: 'references', type: 'array', isArray: true,
            children: [
              { key: 'reference_id', type: 'integer' },
              { key: 'file_path', type: 'string' },
            ],
          },
        ],
      }]
    }

    case 'knowledge_ingest': {
      return [{
        nodeId: node.id,
        nodeLabel: label,
        nodeType: type,
        fields: [
          { key: 'doc_id', type: 'string' },
          { key: 'status', type: 'string' },
        ],
      }]
    }

    case 'trigger': {
      // Before/After/AfterAsync triggers: the dispatcher (internal/triggers/
      // dispatch.go) snapshots the changed record and the engine
      // (internal/engine/workflow.go's mergeTriggerRecord) flattens its NEW
      // field values directly into every downstream node's Vars[...] — there
      // is no separate "record" namespace, so this schema is 'vars'-rooted
      // just like an iterator's loop item, and its keys are the trigger's
      // bound form's real fields when known.
      const cfg = node.data.configuration as TriggerConfig | undefined
      if (cfg?.mode !== 'before' && cfg?.mode !== 'after' && cfg?.mode !== 'after_async') return []
      const form = cfg.form_id ? formsById.get(cfg.form_id) : undefined
      return [{
        nodeId: node.id,
        nodeLabel: `${label} (triggering record)`,
        nodeType: type,
        root: 'vars',
        fields: recordFields(form),
      }]
    }

    default:
      // entry/exit/merge/loop_end/subflow publish nothing addressable yet.
      return []
  }
}

/** The Expr path that addresses an output field. For 'node_outputs' (default)
 *  the path is NodeOutputs["<nodeId>"]["a"]["b"]; for 'vars' (loop item/index)
 *  it is Vars["a"]["b"] (the nodeId is ignored). When the leaf field carries
 *  an `exprPath` (HTTP response schema-mapped fields), that precomputed
 *  string is returned verbatim instead of being derived generically. */
export function outputFieldPath(nodeId: string, path: OutputField[], root: SchemaRoot = 'node_outputs'): string {
  const leaf = path[path.length - 1]
  if (leaf?.exprPath) return leaf.exprPath

  let expr = root === 'vars' ? 'Vars' : `NodeOutputs["${nodeId}"]`
  for (const f of path) {
    expr += `["${f.key}"]`
    if (f.isArray) expr += '[0]'
  }
  return expr
}

/** The Expr path that addresses an entire schema's extracted array/object —
 *  used for the schema-level sibling entry, so a `list` schema can be
 *  dropped directly into an Iterator's source list. */
export function compileSchemaPath(nodeId: string, schema: ResponseSchema): string {
  return `NodeOutputs["${nodeId}"]["${schema.name}"]`
}

/**
 * The Expr path prefix each of a schema's ROW fields is rooted at.
 * Extraction happens server-side (HTTPRequestActivity, using real JSONPath —
 * see internal/graph/configs_http.go's ResponseSchema), which publishes the
 * schema's result as its own NodeOutput entry: NodeOutputs["<id>"]["<name>"]
 * is a map ('single') or an array of maps ('list') — so a field's path is a
 * bracket lookup into the already-extracted row, not a client-side pluck.
 *   - 'single' → NodeOutputs["<id>"]["<schemaName>"]
 *   - 'list'   → NodeOutputs["<id>"]["<schemaName>"][0] (element 0, matching
 *     the [0]-preview convention every other array field uses)
 */
export function compileSchemaRowPath(nodeId: string, schema: ResponseSchema): string {
  const base = compileSchemaPath(nodeId, schema)
  return schema.kind === 'list' ? `${base}[0]` : base
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
