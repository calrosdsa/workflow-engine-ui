export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// Per-node execution outcome, as recorded in graph.NodeStatus (backend).
export type NodeExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'

// A show_message node's published output (engine.MessageOutput, backend).
export interface ExecutionMessage {
  node_id: string
  message: string
  is_html: boolean
  timeout_ms: number
  message_type: 'success' | 'error' | 'info'
}

export interface Execution {
  execution_id: string
  workflow_definition_id: string
  temporal_workflow_id?: string
  temporal_run_id?: string
  status: ExecutionStatus
  final_variables?: Record<string, unknown>
  // nodeID -> status, only for nodes the run actually reached (FR-C5-007).
  node_statuses?: Record<string, NodeExecutionStatus>
  // nodeID -> error text, only for FAILED nodes (FR-B2-012).
  node_errors?: Record<string, string>
  messages?: ExecutionMessage[]
  error_message?: string
  created_at: string
  started_at?: string
  finished_at?: string
}

export interface TriggerResponse {
  execution_id: string
  status: ExecutionStatus
  workflow_definition_id: string
  created_at: string
}
