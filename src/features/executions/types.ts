export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// Per-node execution outcome, as recorded in graph.NodeStatus (backend).
// COMPLETED_WITH_ERRORS is iterator-only: a continue_on_error loop that ran
// every item but had one or more per-item body failures (FR-B2-015).
export type NodeExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'COMPLETED_WITH_ERRORS'

// A show_message node's published output (engine.MessageOutput, backend).
export interface ExecutionMessage {
  node_id: string
  message: string
  is_html: boolean
  timeout_ms: number
  message_type: 'success' | 'error' | 'info'
}

// One item's body failure inside a continue_on_error iterator (FR-B2-015).
export interface ExecutionFailedItem {
  index: number
  item?: unknown
  error: string
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
  // iterator nodeID -> per-item failures, only for continue_on_error
  // iterators with at least one failed item (FR-B2-015).
  iterator_failed_items?: Record<string, ExecutionFailedItem[]>
  // debug nodeID -> captured variable snapshot (FR-B2-013).
  debug_snapshots?: Record<string, {
    variables?: Record<string, unknown>
    label?: string
    // One entry per configured DebugWatch (graph.DebugWatch), in config
    // order — `value` and `error` are mutually exclusive; a compile/eval
    // failure never fails the node itself (see engine's DebugActivity).
    watches?: { name: string; expression: string; value?: unknown; error?: string }[]
  }>
  // nodeID -> non-fatal warning text, independent of node_statuses/node_errors
  // (still COMPLETED — a warning flags what DIDN'T happen, not a failure).
  // Today populated only by an Iterator that processed zero items.
  node_warnings?: Record<string, string>
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

// GET /executions' response envelope — mirrors SearchRecordsResponse
// (features/forms/api.ts), this platform's established paginated-list shape.
export interface ListExecutionsResponse {
  executions: Execution[]
  total: number
  page: number
  page_size: number
}
