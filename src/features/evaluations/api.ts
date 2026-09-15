import { api } from '@/lib/api'
import type {
  EvaluationDataset,
  EvaluationDatasetRow,
  EvaluationRun,
  EvaluationVerdict,
  ListEvaluationDatasetRowsResponse,
  ListEvaluationDatasetsResponse,
  ListEvaluationRunResultsResponse,
  ListEvaluationRunsResponse,
  StartEvaluationRunResponse,
} from './types'

export interface CreateDatasetPayload {
  name: string
  description?: string
  output_variable: string
}

export interface UpdateDatasetPayload {
  name?: string
  description?: string
}

export interface RowPayload {
  name?: string
  variables?: Record<string, unknown>
  trigger_record?: Record<string, unknown>
  expected_output?: string
}

export const evaluationsApi = {
  listDatasets: (workflowId: string) =>
    api.get(`workflows/${workflowId}/evaluation-datasets`).json<ListEvaluationDatasetsResponse>(),

  createDataset: (workflowId: string, payload: CreateDatasetPayload) =>
    api.post(`workflows/${workflowId}/evaluation-datasets`, { json: payload }).json<EvaluationDataset>(),

  getDataset: (datasetId: string) =>
    api.get(`evaluation-datasets/${datasetId}`).json<EvaluationDataset>(),

  updateDataset: (datasetId: string, payload: UpdateDatasetPayload) =>
    api.patch(`evaluation-datasets/${datasetId}`, { json: payload }).json<EvaluationDataset>(),

  deleteDataset: (datasetId: string) =>
    api.delete(`evaluation-datasets/${datasetId}`).json<{ status: string }>(),

  listRows: (datasetId: string) =>
    api.get(`evaluation-datasets/${datasetId}/rows`).json<ListEvaluationDatasetRowsResponse>(),

  addRow: (datasetId: string, payload: RowPayload) =>
    api.post(`evaluation-datasets/${datasetId}/rows`, { json: payload }).json<EvaluationDatasetRow>(),

  // The route is scoped /evaluation-datasets/{dataset_id}/rows/{row_id} even
  // though the backend's row lookup itself is by row_id alone (rows are
  // globally unique) — datasetId is still required here to build the
  // matching URL.
  updateRow: (datasetId: string, rowId: string, payload: RowPayload) =>
    api.put(`evaluation-datasets/${datasetId}/rows/${rowId}`, { json: payload }).json<EvaluationDatasetRow>(),

  deleteRow: (datasetId: string, rowId: string) =>
    api.delete(`evaluation-datasets/${datasetId}/rows/${rowId}`).json<{ status: string }>(),

  listRuns: (datasetId: string) =>
    api.get(`evaluation-datasets/${datasetId}/runs`).json<ListEvaluationRunsResponse>(),

  // Fires the replay, which runs in the background server-side — same
  // "returns immediately, poll for status" contract as
  // executionsApi.trigger.
  startRun: (datasetId: string) =>
    api.post(`evaluation-datasets/${datasetId}/runs`, { json: {} }).json<StartEvaluationRunResponse>(),

  getRun: (runId: string) =>
    api.get(`evaluation-runs/${runId}`).json<EvaluationRun>(),

  listRunResults: (runId: string) =>
    api.get(`evaluation-runs/${runId}/results`).json<ListEvaluationRunResultsResponse>(),

  setVerdict: (runId: string, resultId: string, verdict: EvaluationVerdict) =>
    api
      .post(`evaluation-runs/${runId}/results/${resultId}/verdict`, { json: { verdict } })
      .json<{ id: string; manual_verdict: EvaluationVerdict }>(),

  cancelRun: (runId: string) =>
    api.post(`evaluation-runs/${runId}/cancel`).json<{ status: string }>(),
}
