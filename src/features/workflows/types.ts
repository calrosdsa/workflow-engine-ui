// ---------------------------------------------------------------------------
// Graph model — mirrors internal/graph/graph.go
// ---------------------------------------------------------------------------

export type NodeType =
  | 'entry'
  | 'exit'
  | 'trigger'
  | 'set_variable'
  | 'condition'
  | 'subflow'
  | 'merge'
  | 'fetch_records'
  | 'upsert_records'
  | 'update_records'
  | 'delete_records'
  | 'iterator'
  | 'loop_end'
  | 'http_request'
  | 'show_message'
  | 'transform'
  | 'save_records'
  | 'notification'
  | 'knowledge_retrieval'
  | 'knowledge_ingest'

export type PortKind = 'data' | 'control' | 'trigger'

export interface Port {
  id: string
  label: string
  kind: PortKind
}

export interface NodePosition {
  x: number
  y: number
}

export interface NodeMetadata {
  description?: string
  tags?: string[]
  color?: string
  extra?: Record<string, unknown>
}

// XYFlow requires node data to extend Record<string, unknown>.
export interface GraphNode extends Record<string, unknown> {
  id: string
  type: NodeType
  label: string
  position: NodePosition
  configuration: unknown
  inputs: Port[]
  outputs: Port[]
  metadata?: NodeMetadata
  parent_id?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  source_handle: string
  target_handle: string
  condition?: string
  metadata?: Record<string, unknown>
}

export interface WorkflowMetadata {
  version: number
  description?: string
  author?: string
  tags?: string[]
  viewport_x?: number
  viewport_y?: number
  viewport_zoom?: number
}

export interface VariableDecl {
  name: string
  type: 'string' | 'integer' | 'float' | 'boolean' | 'time' | 'datetime'
  default?: unknown
}

export interface WorkflowDefinitionGraph {
  id: string
  variables: VariableDecl[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: WorkflowMetadata
}

export interface WorkflowDefinition {
  id: string
  name: string
  definition: WorkflowDefinitionGraph
  sort_order: number
  created_at: string
  updated_at: string
  last_execution_status?: string
  last_execution_at?: string
}

export type CreateWorkflowPayload = {
  name: string
  definition: Omit<WorkflowDefinitionGraph, 'id'>
}

export type UpdateWorkflowPayload = CreateWorkflowPayload

export interface ReorderWorkflowsPayload {
  ordered_ids: string[]
}

// ---------------------------------------------------------------------------
// Node configurations
// ---------------------------------------------------------------------------

export type AssignMode = 'literal' | 'expression'

export interface VariableAssignment {
  id: string           // local UI-only key for list rendering (not sent to backend)
  variable_name: string
  mode: AssignMode
  literal_value?: unknown
  expression?: string
}

/** Multi-assignment set_variable config. `assignments` is the canonical field.
 *  Legacy single-field payloads from the backend are normalised on load. */
export interface SetVariableConfig {
  assignments: VariableAssignment[]
}

export interface ConditionConfig {
  expression: string
}

export interface SubflowConfig {
  definition_id: string
}

// ---------------------------------------------------------------------------
// Database node configs (mirror internal/graph/configs_db.go)
// ---------------------------------------------------------------------------

export type CompareOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'in' | 'is_null' | 'not_null'
  // Change-detection family — evaluated against an OLD-vs-NEW record pair
  // (see internal/expr/changedetect.go). Only meaningful inside a Trigger
  // node's filter (before/after/after_async modes).
  | 'was_updated'

export type ValueMode = 'static' | 'expression' | 'change_flag'

export interface FilterCondition {
  id: string                // UI-only key for list rendering (stripped on save)
  field: string             // form field key
  op: CompareOp
  value_mode?: ValueMode
  value?: unknown
  expression?: string
}

export interface FilterGroup {
  id?: string               // UI-only key (stripped on save)
  combinator: 'and' | 'or'
  conditions: FilterCondition[]
  groups: FilterGroup[]
}

export interface SortRule {
  id: string                // UI-only key (stripped on save)
  field: string
  dir: 'asc' | 'desc'
}

export type FetchMode = 'many' | 'one'

export interface FetchRecordsConfig {
  form_id: string
  mode: FetchMode
  filter?: FilterGroup
  refine_expr?: string
  sort: SortRule[]
  limit: number
  output_var: string
  count_var?: string
}

// ---------------------------------------------------------------------------
// Shared write model (reused by upsert / update nodes) — mirrors the value
// half of FilterCondition, one entry per column to write.
// ---------------------------------------------------------------------------

export interface FieldValue {
  id: string                // UI-only key for list rendering (stripped on save)
  field: string              // form field key
  value_mode?: ValueMode
  value?: unknown
  expression?: string
}

/** "one" = filter must match at most one record (error if it matches >1).
 *  "many" = apply to every match. */
export type RecordMatchMode = 'one' | 'many'

// ---------------------------------------------------------------------------
// upsert_records — create-or-update by the target form's unique fields.
// Match keys are NOT configured here: they're derived from the form's schema.
// ---------------------------------------------------------------------------

export interface UpsertRecordsConfig {
  form_id: string
  values: FieldValue[]
  output_var?: string
}

// ---------------------------------------------------------------------------
// update_records — update record(s) matching a filter.
// ---------------------------------------------------------------------------

export interface UpdateRecordsConfig {
  form_id: string
  mode: RecordMatchMode
  filter?: FilterGroup
  values: FieldValue[]
  output_var?: string
  count_var?: string
}

// ---------------------------------------------------------------------------
// delete_records — delete record(s) matching a filter.
// ---------------------------------------------------------------------------

export interface DeleteRecordsConfig {
  form_id: string
  mode: RecordMatchMode
  filter?: FilterGroup
  count_var?: string
}

// ---------------------------------------------------------------------------
// transform — mirrors internal/graph/configs_transform.go. Maps a source list
// (e.g. fetch_records' "records" or an http_request response_schemas list)
// into a target form's schema, one mapped record per source item.
// ---------------------------------------------------------------------------

export interface TransformFieldMap {
  id: string                // UI-only key for list rendering (stripped on save)
  field: string              // target form field key
  value_mode?: ValueMode
  value?: unknown
  expression?: string
}

export interface TransformConfig {
  /** Expr → the source list, e.g. NodeOutputs["fetch1"]["records"]. */
  source_expr: string
  /** Target form whose fields the mappings are keyed against. */
  form_id: string
  mappings: TransformFieldMap[]
  output_var?: string
}

// ---------------------------------------------------------------------------
// save_records — mirrors internal/graph/configs_transform.go. Bulk-upserts a
// list of records (typically a Transform node's "records" output) into a
// single form in one activity call. Match keys are derived from the target
// form's unique fields, same as upsert_records.
// ---------------------------------------------------------------------------

export interface SaveRecordsConfig {
  /** Expr → the list of records to save, e.g. NodeOutputs["t1"]["records"]. */
  source_expr: string
  form_id: string
  output_var?: string
  count_var?: string
}

// ---------------------------------------------------------------------------
// Iterator (foreach loop) — mirrors internal/graph/configs_loop.go
// ---------------------------------------------------------------------------

export interface IteratorConfig {
  /** Expr → the list to iterate, e.g. NodeOutputs["fetch"]["records"]. */
  source_expr: string
  /** Loop-scoped variable names exposing the current element + index. */
  item_var?: string
  index_var?: string
  /** Per-element: run the body only when truthy. */
  filter_expr?: string
  /** Optional while/until: stop the loop when truthy. */
  stop_expr?: string
  /** Safety cap on iterations (0 = unlimited). */
  max_iters?: number
  /** The paired Loop End node id that closes the body. */
  loop_end_id: string
}

// ---------------------------------------------------------------------------
// http_request — mirrors internal/graph/configs_http.go
// ---------------------------------------------------------------------------

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
export type HTTPAuthType = 'none' | 'basic' | 'bearer' | 'api_key' | 'credential'
export type HTTPBodyMode = 'none' | 'json' | 'form' | 'raw'

/** A single header or query-param row. Mirrors FieldValue with `field`
 *  renamed to `key`, plus an Enabled flag (Postman-style checkbox — a
 *  disabled row is kept but not sent). */
export interface KeyValuePair {
  id: string                // UI-only key for list rendering (stripped on save)
  key: string
  enabled: boolean
  value_mode?: ValueMode
  value?: unknown
  expression?: string
}

export interface HttpRequestConfig {
  method: HTTPMethod

  url_mode?: ValueMode
  url?: string
  url_expr?: string

  params: KeyValuePair[]
  headers: KeyValuePair[]

  body_mode?: HTTPBodyMode
  body_value_mode?: ValueMode
  body_value?: string
  body_expression?: string
  body_raw_content_type?: string
  body_form: KeyValuePair[]

  auth_type?: HTTPAuthType
  auth_credential?: string

  auth_username_mode?: ValueMode
  auth_username?: string
  auth_username_expr?: string

  auth_password_mode?: ValueMode
  auth_password?: string
  auth_password_expr?: string

  auth_token_mode?: ValueMode
  auth_token?: string
  auth_token_expr?: string

  auth_api_key_name?: string
  auth_api_key_location?: 'header' | 'query'
  auth_api_key_value_mode?: ValueMode
  auth_api_key_value?: string
  auth_api_key_value_expr?: string

  timeout_ms?: number
  output_var?: string

  response_schemas?: ResponseSchema[]
}

// ---------------------------------------------------------------------------
// http_request — response schema mapping. Extracted server-side by
// HTTPRequestActivity (internal/activities/http_request.go) using real
// JSONPath (github.com/ohler55/ojg/jp) and published as its own sibling
// NodeOutput entry (NodeOutputs[nodeId][schema.name]) alongside the fixed
// status/body/headers keys — see internal/graph/configs_http.go's
// ResponseSchema/ResponseSchemaField for the mirrored Go types.
//
// This is a self-contained data structure scoped entirely to
// HttpRequestConfig — it has no relationship to the form/FieldDef system
// used by fetch_records/upsert_records/update_records. The only thing
// shared with that system is the plain vocabulary of type-name strings
// below, reused purely so a mapped field's badge gets the same TYPE_COLORS
// treatment as every other typed field in ExpressionEditor.tsx — not a
// structural import of FieldType.
// ---------------------------------------------------------------------------

export type ResponseFieldType = 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'time' | 'object'

/** One row in a schema card: a JSONPath into one element (for a `list`
 *  schema) or into the single response object (for `single`), its declared
 *  output type (a best-effort coercion hint, never fails extraction), and
 *  the target field name shown downstream. A plain dot-path like
 *  "address.geo.lat" is already valid trivial JSONPath — no migration
 *  needed for existing schemas. For a `headers`-sourced schema, path is a
 *  literal (case-insensitive) header name, not JSONPath — e.g.
 *  "content-type" (hyphens aren't valid bare-word JSONPath). */
export interface ResponseSchemaField {
  id: string                    // UI-only key for list rendering (stripped on save)
  path: string                  // JSONPath, e.g. "id" or "address.geo.lat"; literal header name for a headers source
  type: ResponseFieldType
  name: string                  // target field name shown downstream, e.g. "Id"
}

export type ResponseSchemaKind   = 'list' | 'single'
export type ResponseSchemaSource = 'body' | 'headers'

/** One named schema card ("Users", "Profile", etc.) mapping paths in the
 *  parsed response into named+typed fields. A `list` schema's extracted
 *  value is a real array (NodeOutputs[nodeId][schema.name]) that can be
 *  used directly as an Iterator's source list, with per-field autocomplete
 *  inside the loop body — see node-output-schema.ts's inferItemFields. */
export interface ResponseSchema {
  id: string                    // UI-only key for list rendering (stripped on save)
  name: string                  // e.g. "Users" — becomes the browsable node-context label
  kind: ResponseSchemaKind       // 'list' → response is an array of objects; 'single' → one object
  source: ResponseSchemaSource   // 'body' (parsed JSON) | 'headers' (flat header map)
  fields: ResponseSchemaField[]
}

// ---------------------------------------------------------------------------
// trigger — mirrors internal/graph/configs_trigger.go. Drives NodeTypeTrigger,
// the entry point of every workflow (supersedes the legacy 'entry' node).
// ---------------------------------------------------------------------------

export type TriggerMode = 'on_demand' | 'scheduled' | 'before' | 'after' | 'after_async'

export type TriggerEventType = 'create' | 'update' | 'delete' | 'create_or_update'

export interface TriggerConfig {
  mode: TriggerMode

  // Scheduled mode.
  cron?: string
  timezone?: string
  description?: string

  // Before / After / AfterAsync (data-driven) modes.
  form_id?: string
  event_type?: TriggerEventType
  filter?: FilterGroup

  enabled: boolean
}

// ---------------------------------------------------------------------------
// show_message — mirrors internal/graph/configs_message.go. Publishes a
// message the workflow-triggers dispatcher (internal/triggers) and the
// executions API surface to a caller: an error-type message in Before mode
// blocks the write, in After mode becomes a non-fatal warning.
// ---------------------------------------------------------------------------

export type MessageType = 'success' | 'error' | 'info'

export interface ShowMessageConfig {
  message: string
  is_html?: boolean
  timeout_ms?: number
  message_type: MessageType
}

// ---------------------------------------------------------------------------
// notification — mirrors internal/graph/configs_notification.go. Writes a
// persisted, in-app notification for a single recipient user, read by the
// runtime app's notification center — unlike show_message, this survives
// until the recipient reads it and reaches users who never triggered the
// workflow themselves.
// ---------------------------------------------------------------------------

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationConfig {
  recipient_mode: ValueMode
  recipient_user_id?: string
  recipient_expr?: string
  title: string
  body?: string
  severity: NotificationSeverity
  link_url?: string
}

// ---------------------------------------------------------------------------
// knowledge_retrieval / knowledge_ingest — mirrors internal/graph/configs_rag.go
// ---------------------------------------------------------------------------

export type KnowledgeQueryMode = 'naive' | 'local' | 'global' | 'hybrid' | 'mix' | 'bypass'

export interface KnowledgeRetrievalConfig {
  kb_id: string
  mode?: KnowledgeQueryMode
  query_mode?: ValueMode
  query?: string
  query_expr?: string
  include_answer: boolean
  response_type?: string
  user_prompt?: string
  top_k?: number
  chunk_top_k?: number
  output_var: string
}

export interface KnowledgeIngestConfig {
  kb_id: string
  content_mode?: ValueMode
  content?: string
  content_expr?: string
  file_name_mode?: ValueMode
  file_name?: string
  file_name_expr?: string
  output_var: string
}
