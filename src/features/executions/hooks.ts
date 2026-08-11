import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { executionsApi, type ListExecutionsParams } from './api'
import type { ExecutionStatus } from './types'

export const executionKeys = {
  all:      (params: ListExecutionsParams = {}) => ['executions', params] as const,
  detail:   (id: string)     => ['executions', id] as const,
}

const TERMINAL: ExecutionStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

// Lists one page of executions. params defaults to {} — the backend's own
// default page (1) / page_size (25) apply when omitted, matching
// useExecutions()'s pre-pagination "just give me executions" call shape.
export function useExecutions(params: ListExecutionsParams = {}) {
  return useQuery({
    queryKey: executionKeys.all(params),
    queryFn:  () => executionsApi.list(params),
  })
}

// A lightweight count-only read for stat tiles (e.g. the Dashboard's
// "Completed" tile) — reuses the same paginated endpoint but only reads
// .total, with page_size: 1 so the server does no more row-fetching work
// than necessary for a number nobody renders per-row.
export function useExecutionCount(status?: ExecutionStatus) {
  return useQuery({
    queryKey: [...executionKeys.all({ status }), 'count'] as const,
    queryFn:  () => executionsApi.list({ status, page: 1, pageSize: 1 }),
    select:   (data) => data.total,
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
