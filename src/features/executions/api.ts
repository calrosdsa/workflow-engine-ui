import { api } from '@/lib/api'
import type { Execution, TriggerResponse } from './types'

export const executionsApi = {
  list: (definitionId?: string) => {
    const url = definitionId
      ? `executions?workflow_definition_id=${definitionId}`
      : 'executions'
    return api.get(url).json<Execution[]>()
  },

  get: (executionId: string) =>
    api.get(`executions/${executionId}`).json<Execution>(),

  trigger: (definitionId: string) =>
    api
      .post('executions', { json: { workflow_definition_id: definitionId } })
      .json<TriggerResponse>(),
}
