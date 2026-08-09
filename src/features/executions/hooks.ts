import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { executionsApi } from './api'
import type { ExecutionStatus } from './types'

export const executionKeys = {
  all:      (defId?: string) => defId ? ['executions', { defId }] as const : ['executions'] as const,
  detail:   (id: string)     => ['executions', id] as const,
}

const TERMINAL: ExecutionStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export function useExecutions(definitionId?: string) {
  return useQuery({
    queryKey: executionKeys.all(definitionId),
    queryFn:  () => executionsApi.list(definitionId),
  })
}

// Polls every 2 s until the execution reaches a terminal state. Disabled
// when executionId is empty (e.g. the Workflow Builder's execution overlay
// has nothing selected) rather than firing a request with a blank ID.
export function useExecution(executionId: string) {
  return useQuery({
    queryKey: executionKeys.detail(executionId),
    queryFn:  () => executionsApi.get(executionId),
    enabled:  executionId !== '',
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL.includes(status) ? false : 2000
    },
  })
}

export function useTriggerExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (definitionId: string) => executionsApi.trigger(definitionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}
