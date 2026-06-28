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

export interface SetVariableConfig {
  variable_name: string
  mode: AssignMode
  literal_value?: unknown
  expression?: string
}

export interface ConditionConfig {
  expression: string
}

export interface SubflowConfig {
  definition_id: string
}
