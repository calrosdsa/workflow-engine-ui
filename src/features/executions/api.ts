import { api } from '@/lib/api'
import type { Execution, ExecutionStatus, ListExecutionsResponse, TriggerResponse } from './types'

export interface ListExecutionsParams {
  definitionId?: string
  status?: ExecutionStatus
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

  trigger: (definitionId: string) =>
    api
      .post('executions', { json: { workflow_definition_id: definitionId } })
      .json<TriggerResponse>(),
}
