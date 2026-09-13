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

// Status vocabulary for a single node-timing/log entry. Deliberately its own
// 4-member union, NOT widened to NodeExecutionStatus (6 members, adds
// PENDING/COMPLETED_WITH_ERRORS) or ExecutionStatus (5 members, adds
// CANCELLED instead of SKIPPED) — those describe an execution or a node's
// *overlay* outcome, while this describes one timing/log row as the backend
// actually emits it. Keeping them separate lets the compiler catch any
// accidental mixing (e.g. indexing an ExecutionStatus-keyed map with one of
// these) instead of silently accepting a status the map never declared.
export type ExecutionLogStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'

// Per-node timing captured during a run (new field, see GET /executions/{id}).
// Keyed by node_id on Execution.node_timings. A node_id absent from this map
// means either "not reached" or "a structurally activity-free node type
// (Entry/Exit/Merge/LoopEnd/Trigger) that never gets a timing entry" — use
// node_statuses (which DOES have an entry for any reached node) to tell
// those two cases apart, not the absence of a node_timings entry alone.
export interface NodeTiming {
  status: ExecutionLogStatus
  duration_ms: number
  attempt: number
}

// One row of GET /executions/{id}/logs — the real Input/Output payload that
// flowed through a single node execution (or trigger firing, or loop-body
// chunk). Field names mirror the backend contract exactly.
export interface ExecutionNodeLog {
  id: string
  execution_id: string
  node_id: string
  node_type: string
  kind: 'node' | 'trigger' | 'loop_chunk'
  attempt: number
  status: ExecutionLogStatus
  started_at: string // RFC3339
  finished_at: string | null
  duration_ms: number | null
  input: unknown | null
  output: unknown | null
  error_message: string | null
  dropped_payload: boolean
  chunk_index: number | null
  chunk_count: number | null
  item_count: number | null
  failed_item_count: number | null
  trace_id: string | null
  span_id: string | null
}

// GET /executions/{id}/logs response envelope. Rows are ordered
// chronologically (started_at ASC) by the backend — a kind:'trigger' row
// always comes first.
export interface ExecutionLogsResponse {
  logs: ExecutionNodeLog[]
  total: number
  page: number
  page_size: number
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
  // nodeID -> live status/duration/attempt for this run (FR-C5-007 per-node
  // duration). Rides the same poll as everything else on this type — no
  // separate request needed for the canvas's per-node duration badge.
  node_timings?: Record<string, NodeTiming>
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
