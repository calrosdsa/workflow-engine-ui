import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { evaluationsApi } from './api'
import type { CreateDatasetPayload, RowPayload, UpdateDatasetPayload } from './api'
import type { EvaluationRunStatus, EvaluationVerdict } from './types'

// Nested under 'evaluations' the same way executionKeys nests everything
// under 'executions' — a broad invalidateQueries({queryKey: ['evaluations']})
// catches datasets/rows/runs/results together.
export const evaluationKeys = {
  all:        (workflowId: string) => ['evaluations', 'datasets', workflowId] as const,
  dataset:    (datasetId: string) => ['evaluations', 'dataset', datasetId] as const,
  rows:       (datasetId: string) => ['evaluations', 'dataset', datasetId, 'rows'] as const,
  runs:       (datasetId: string) => ['evaluations', 'dataset', datasetId, 'runs'] as const,
  run:        (runId: string) => ['evaluations', 'run', runId] as const,
  runResults: (runId: string) => ['evaluations', 'run', runId, 'results'] as const,
}

const RUN_TERMINAL: EvaluationRunStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export function useEvaluationDatasets(workflowId: string) {
  return useQuery({
    queryKey: evaluationKeys.all(workflowId),
    queryFn:  () => evaluationsApi.listDatasets(workflowId),
    enabled:  !!workflowId,
    select:   (data) => data.datasets,
  })
}

export function useEvaluationDataset(datasetId: string | undefined) {
  return useQuery({
    queryKey: evaluationKeys.dataset(datasetId ?? ''),
    queryFn:  () => evaluationsApi.getDataset(datasetId as string),
    enabled:  !!datasetId,
  })
}

export function useEvaluationDatasetRows(datasetId: string | undefined) {
  return useQuery({
    queryKey: evaluationKeys.rows(datasetId ?? ''),
    queryFn:  () => evaluationsApi.listRows(datasetId as string),
    enabled:  !!datasetId,
    select:   (data) => data.rows,
  })
}

// Self-polls every 2s whenever any run in the list is still RUNNING (a
// dataset can have at most one active run at a time in practice, but this
// checks the whole list rather than assuming that) — otherwise a run
// started via useRunEvaluation would only ever show its initial RUNNING/0
// snapshot until the page was manually reloaded.
export function useEvaluationRuns(datasetId: string | undefined) {
  return useQuery({
    queryKey: evaluationKeys.runs(datasetId ?? ''),
    queryFn:  () => evaluationsApi.listRuns(datasetId as string),
    enabled:  !!datasetId,
    select:   (data) => data.runs,
    refetchInterval: (query) => {
      const runs = query.state.data?.runs
      const active = runs?.some((r) => !RUN_TERMINAL.includes(r.status))
      return active ? 2000 : false
    },
  })
}

// Polls every 2s until the run reaches a terminal state — same shape as
// useExecution's identical poll-until-terminal hook.
export function useEvaluationRun(runId: string | undefined) {
  return useQuery({
    queryKey: evaluationKeys.run(runId ?? ''),
    queryFn:  () => evaluationsApi.getRun(runId as string),
    enabled:  !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && RUN_TERMINAL.includes(status) ? false : 2000
    },
  })
}

// Polls every 2s while the caller says the parent run is still RUNNING.
// Deliberately takes the run's status as an explicit option (mirroring
// useExecutionLogs' identical executionStatus param) rather than inferring
// it from this query's own data: results land one row at a time as the
// backend's replay loop finishes each row (see api/evaluations' runDataset),
// so an active run can easily have zero or partial results — inferring
// "still running" from an empty/all-terminal results array would stop
// polling before the remaining rows ever arrive.
export function useEvaluationRunResults(runId: string | undefined, options: { runStatus?: EvaluationRunStatus } = {}) {
  const active = options.runStatus === 'RUNNING'
  return useQuery({
    queryKey: evaluationKeys.runResults(runId ?? ''),
    queryFn:  () => evaluationsApi.listRunResults(runId as string),
    enabled:  !!runId,
    select:   (data) => data.results,
    refetchInterval: active ? 2000 : false,
  })
}

export function useCreateEvaluationDataset(workflowId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDatasetPayload) => evaluationsApi.createDataset(workflowId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: evaluationKeys.all(workflowId) }),
  })
}

export function useUpdateEvaluationDataset(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateDatasetPayload) => evaluationsApi.updateDataset(datasetId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: evaluationKeys.dataset(datasetId) }),
  })
}

export function useDeleteEvaluationDataset(workflowId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datasetId: string) => evaluationsApi.deleteDataset(datasetId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: evaluationKeys.all(workflowId) }),
  })
}

export function useAddEvaluationRow(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RowPayload) => evaluationsApi.addRow(datasetId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.rows(datasetId) })
      qc.invalidateQueries({ queryKey: evaluationKeys.dataset(datasetId) }) // row_count changed
    },
  })
}

export function useUpdateEvaluationRow(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rowId, payload }: { rowId: string; payload: RowPayload }) => evaluationsApi.updateRow(datasetId, rowId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: evaluationKeys.rows(datasetId) }),
  })
}

export function useDeleteEvaluationRow(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rowId: string) => evaluationsApi.deleteRow(datasetId, rowId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.rows(datasetId) })
      qc.invalidateQueries({ queryKey: evaluationKeys.dataset(datasetId) })
    },
  })
}

export function useRunEvaluation(datasetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => evaluationsApi.startRun(datasetId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: evaluationKeys.runs(datasetId) }),
  })
}

export function useSetEvaluationVerdict(runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ resultId, verdict }: { resultId: string; verdict: EvaluationVerdict }) => evaluationsApi.setVerdict(runId, resultId, verdict),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.runResults(runId) })
      qc.invalidateQueries({ queryKey: evaluationKeys.run(runId) }) // pass/fail tally changed
    },
  })
}

export function useCancelEvaluationRun(datasetId: string, runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => evaluationsApi.cancelRun(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.run(runId) })
      qc.invalidateQueries({ queryKey: evaluationKeys.runs(datasetId) })
    },
  })
}
