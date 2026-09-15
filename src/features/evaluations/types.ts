// Wire shapes for Workflow Evaluations v1 ("light" evaluation) — field names
// mirror api/evaluations/handler.go's response types exactly.

export interface EvaluationDataset {
  id: string
  workflow_definition_id: string
  name: string
  description?: string
  output_variable: string
  row_count: number
  created_at: string
  updated_at: string
}

export interface EvaluationDatasetRow {
  id: string
  dataset_id: string
  row_order: number
  name?: string
  variables: Record<string, unknown>
  trigger_record?: Record<string, unknown>
  expected_output?: string
  created_at: string
  updated_at: string
}

export type EvaluationRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface EvaluationRun {
  id: string
  dataset_id: string
  status: EvaluationRunStatus
  total_rows: number
  completed_rows: number
  // Manual pass/fail tally (v1) — reflects set_evaluation_verdict calls, not
  // whether each row's replay itself completed or failed (see
  // EvaluationRowResult.status for that).
  passed_rows: number
  failed_rows: number
  started_at: string
  finished_at?: string
}

// Mirrors the row's own execution outcome — RUNNING/COMPLETED/FAILED, not the
// broader ExecutionStatus union (no PENDING/CANCELLED: a replay's execution
// row is created and dispatched synchronously, see internal/datasetreplay).
export type EvaluationRowResultStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'
export type EvaluationVerdict = 'pass' | 'fail'

// One row's result, joined with the dataset row it replayed (variables/
// trigger_record/expected_output) — see api/evaluations's
// EvaluationRowResultDetail on the backend.
export interface EvaluationRowResult {
  id: string
  run_id: string
  dataset_row_id: string
  row_order: number
  row_name?: string
  variables: Record<string, unknown>
  trigger_record?: Record<string, unknown>
  // execution_id lets a row's full node-by-node trace be inspected via the
  // existing execution detail page/ExecutionLogsPanel — no separate trace
  // viewer needed for evaluations.
  execution_id?: string
  status: EvaluationRowResultStatus
  expected_output?: string
  actual_output?: string
  // undefined = not yet reviewed, distinct from a future tri-state — see
  // this platform's manual_verdict column doc comment.
  manual_verdict?: EvaluationVerdict
  error_message?: string
  created_at: string
}

export interface ListEvaluationDatasetsResponse { datasets: EvaluationDataset[] }
export interface ListEvaluationDatasetRowsResponse { rows: EvaluationDatasetRow[] }
export interface ListEvaluationRunsResponse { runs: EvaluationRun[] }
export interface ListEvaluationRunResultsResponse { results: EvaluationRowResult[] }
export interface StartEvaluationRunResponse { run_id: string }
