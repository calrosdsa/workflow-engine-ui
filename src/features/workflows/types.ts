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
  | 'debug'
  | 'run_agent'
  | 'send_to_session'
  | 'generate_report'

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

/** Copies one of the CALLED workflow's final declared variables into one of
 *  THIS (calling) workflow's own declared variables — only applied when
 *  SubflowConfig.sync is true. Mirrors internal/graph.SubflowOutputMapping. */
export interface SubflowOutputMapping {
  id: string // local UI-only key for list rendering (not sent to backend)
  source_variable: string // a variable name declared on the CALLED definition
  target_variable: string // a variable name declared on THIS definition
}

/** Execute Workflow node config — mirrors internal/graph.SubflowConfig.
 *  input_mappings reuses VariableAssignment's literal/expression shape, but
 *  each entry's variable_name names one of the CALLED definition's declared
 *  variables (not this workflow's own), and an expression is evaluated
 *  against THIS (calling) workflow's own Vars/NodeOutputs. */
export interface SubflowConfig {
  definition_id: string
  input_mappings?: VariableAssignment[]
  sync: boolean
  output_mappings?: SubflowOutputMapping[]
}

// ---------------------------------------------------------------------------
// Database node configs (mirror internal/graph/configs_db.go)
// ---------------------------------------------------------------------------

export type CompareOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'in' | 'is_null' | 'not_null'
  // Full-text search against the form's combined "tsv" column (fields marked
  // searchable). Unlike every other op, `field` is ignored — there is no
  // single per-field column to target. Not supported inside a Trigger node's
  // filter (see internal/graph/filter_expr.go — no in-memory tsvector
  // equivalent to evaluate against).
  | 'search'
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
  /** When true, a body failure on one item is recorded and the loop advances
   *  to the next item instead of stopping. Default false (fail-fast). */
  continue_on_error?: boolean
}

/** One item's body failure inside a continue_on_error loop. */
export interface FailedItem {
  index: number
  item?: unknown
  error: string
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

export type ResponseFieldType = 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'time' | 'object' | 'list'

/** One row in a schema card: a JSONPath into one element (for a `list`
 *  schema) or into the single response object (for `single`), its declared
 *  output type (a best-effort coercion hint, never fails extraction), and
 *  the target field name shown downstream. A plain dot-path like
 *  "address.geo.lat" is already valid trivial JSONPath — no migration
 *  needed for existing schemas. For a `headers`-sourced schema, path is a
 *  literal (case-insensitive) header name, not JSONPath — e.g.
 *  "content-type" (hyphens aren't valid bare-word JSONPath).
 *
 *  A field typed 'list' is a NESTED array within the row (e.g. an "Orders"
 *  schema's own "items" field) — path is evaluated relative to the current
 *  element and must resolve to an array; `fields` describes each nested
 *  element's own shape, recursively, the same way a top-level `list` schema's
 *  `fields` does (see internal/graph/configs_http.go's ResponseSchemaField).
 *  Required (non-empty) when type is 'list', unused otherwise. */
export interface ResponseSchemaField {
  id: string                    // UI-only key for list rendering (stripped on save)
  path: string                  // JSONPath, e.g. "id" or "address.geo.lat"; literal header name for a headers source
  type: ResponseFieldType
  name: string                  // target field name shown downstream, e.g. "Id"
  fields?: ResponseSchemaField[] // only when type === 'list'
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

export type TriggerMode =
  | 'on_demand'
  | 'scheduled'
  | 'before'
  | 'after'
  | 'after_async'
  | 'on_demand_data_driven'
  | 'webhook'
  | 'executed_by_workflow'
  | 'on_error'

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

  // on_demand_data_driven mode only (FR-B3-007). Which form's records this
  // trigger accepts when manually dispatched — optional, unlike Before/
  // After/AfterAsync's required form_id; empty means any form may dispatch.
  source_form_id?: string

  // webhook mode only. Server-minted (see api/workflows.Handler.
  // syncWebhook) — read-only from the frontend's perspective; the builder
  // displays it as part of a full URL, never lets the user edit it directly.
  webhook_token?: string

  // on_error mode only. Which workflow's FAILED executions this trigger
  // reacts to — empty means "any workflow in this app" (excluding this
  // definition itself).
  source_definition_id?: string

  enabled: boolean

  // expose_as_tool (FR-C8-004) — orthogonal to mode: this workflow keeps
  // whatever mode already governs its normal dispatch and can ALSO be made
  // callable as an Agent tool. Off by default.
  expose_as_tool?: boolean
  tool_name?: string
  tool_description?: string
  tool_parameters?: ToolParameter[]
}

// ToolParameter mirrors internal/graph/configs_trigger.go's ToolParameter —
// one of this workflow's own declared Variables, exposed as one input of
// its tool-calling surface (FR-C8-004).
export interface ToolParameter {
  variable_name: string
  description: string
}

// ExposedTool mirrors api/workflows/handler.go's exposedToolResponse — one
// workflow exposed as an Agent tool, as read by the Agent editor's Tools
// section (FR-C8-004).
export interface ExposedTool {
  definition_id: string
  workflow_name: string
  tool_name: string
  description: string
  parameters: ToolParameter[]
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

// ---------------------------------------------------------------------------
// generate_report — mirrors internal/graph/configs_report.go's
// ReportGenerateConfig (FR-B2-031). Modeled directly on
// KnowledgeRetrievalConfig's own static/expression split for Parameters.
// ---------------------------------------------------------------------------

export type ReportExportFormat = 'csv' | 'xlsx' | 'xls' | 'pdf' | 'docx' | 'markdown'

export interface ReportGenerateConfig {
  report_definition_id: string
  format?: ReportExportFormat | ''
  parameters_mode?: ValueMode
  parameters?: Record<string, unknown>
  parameters_expr?: string
  output_var: string
}

// ---------------------------------------------------------------------------
// run_agent / send_to_session — mirrors internal/graph/configs.go's
// RunAgentConfig/SendToSessionConfig (FR-B2-029/030). input_mappings is
// deliberately NOT surfaced here — FR-C5-013 v0.2 dropped it from
// RunAgentForm after confirming Subflow's own mapping editor has no
// equivalent "target's declared variables" concept for an Agent to map
// into; the backend field stays unset from this UI.
// ---------------------------------------------------------------------------

export type TaskMode = 'literal' | 'expression'

export interface RunAgentConfig {
  agent_id: string
  task_mode: TaskMode
  task?: string
  task_expr?: string
  output_var: string
}

export interface SendToSessionConfig {
  session_id_mode: ValueMode
  session_id?: string
  session_id_expr?: string
  content_mode: ValueMode
  content?: string
  content_expr?: string
}

// ---------------------------------------------------------------------------
// debug — mirrors internal/graph/configs_debug.go. A pass-through node that
// captures a snapshot of the current variable state at its position in the
// graph, for later inspection via the execution sidebar (FR-B2-013).
// ---------------------------------------------------------------------------

// One named expression captured into a debug node's snapshot for inspection
// — purely observational, never written to workflow state (mirrors
// graph.DebugWatch). `id` is a local-only key for list rendering, not sent
// to the backend, same convention as VariableAssignment.id above.
export interface DebugWatch {
  id: string
  name: string
  expression: string
}

export interface DebugConfig {
  label?: string
  watches?: DebugWatch[]
}
