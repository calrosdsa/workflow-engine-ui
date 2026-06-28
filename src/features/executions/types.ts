export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface Execution {
  execution_id: string
  workflow_definition_id: string
  temporal_workflow_id?: string
  temporal_run_id?: string
  status: ExecutionStatus
  final_variables?: Record<string, unknown>
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
