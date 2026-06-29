// ---------------------------------------------------------------------------
// Graph model — mirrors internal/graph/graph.go
// ---------------------------------------------------------------------------

export type NodeType =
  | 'entry'
  | 'exit'
  | 'set_variable'
  | 'condition'
  | 'subflow'
  | 'merge'
  | 'fetch_records'

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
  created_at: string
  updated_at: string
}

export type CreateWorkflowPayload = {
  name: string
  definition: Omit<WorkflowDefinitionGraph, 'id'>
}

export type UpdateWorkflowPayload = CreateWorkflowPayload

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

export type ValueMode = 'static' | 'expression'

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
