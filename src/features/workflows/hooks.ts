import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from './api'
import type { CreateWorkflowPayload, UpdateWorkflowPayload, ReorderWorkflowsPayload } from './types'

export const workflowKeys = {
  all:    ['workflows'] as const,
  detail: (id: string) => ['workflows', id] as const,
}

export function useWorkflows() {
  return useQuery({ queryKey: workflowKeys.all, queryFn: workflowsApi.list })
}

// Backs the Agent editor's Tools section (FR-C8-004) — a separate query key
// from workflowKeys.all since it's gated assistant:read, not workflows:read,
// and a different set of callers invalidate/consume it.
export function useExposedTools() {
  return useQuery({ queryKey: ['workflows', 'exposed-as-tools'] as const, queryFn: workflowsApi.exposedAsTools })
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: () => workflowsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateWorkflowPayload) => workflowsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  })
}

export function useUpdateWorkflow(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateWorkflowPayload) => workflowsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.all })
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) })
    },
  })
}

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  })
}

export function useReorderWorkflows() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: ReorderWorkflowsPayload) => workflowsApi.reorder(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  })
}
