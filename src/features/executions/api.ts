import { api } from '@/lib/api'
import type { Execution, ExecutionLogsResponse, ExecutionStatus, ListExecutionsResponse, TriggerResponse } from './types'

export interface ListExecutionsParams {
  definitionId?: string
  status?: ExecutionStatus
  page?: number
  pageSize?: number
}

export interface GetExecutionLogsParams {
  nodeId?: string
  page?: number
  pageSize?: number
}

export const executionsApi = {
  list: (params: ListExecutionsParams = {}) => {
    const { definitionId, status, page, pageSize } = params
    const q = new URLSearchParams()
    if (definitionId) q.set('workflow_definition_id', definitionId)
    if (status) q.set('status', status)
    if (page) q.set('page', String(page))
    if (pageSize) q.set('page_size', String(pageSize))
    const qs = q.toString()
    return api.get(`executions${qs ? `?${qs}` : ''}`).json<ListExecutionsResponse>()
  },

  get: (executionId: string) =>
    api.get(`executions/${executionId}`).json<Execution>(),

  // GET /executions/{id}/logs — the real Input/Output payload per step
  // (FR-C5-007 Logs panel). page_size defaults to 50 server-side, capped at
  // 200; callers wanting "everything" (e.g. real chronological node
  // ordering on the canvas) should pass pageSize: 200 explicitly.
  getLogs: (executionId: string, params: GetExecutionLogsParams = {}) => {
    const { nodeId, page, pageSize } = params
    const q = new URLSearchParams()
    if (nodeId) q.set('node_id', nodeId)
    if (page) q.set('page', String(page))
    if (pageSize) q.set('page_size', String(pageSize))
    const qs = q.toString()
    return api.get(`executions/${executionId}/logs${qs ? `?${qs}` : ''}`).json<ExecutionLogsResponse>()
  },

  trigger: (definitionId: string) =>
    api
      .post('executions', { json: { workflow_definition_id: definitionId } })
      .json<TriggerResponse>(),
}
