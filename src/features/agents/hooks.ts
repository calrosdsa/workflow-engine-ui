import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from './api'
import type { CreateAgentPayload, UpdateAgentPayload } from './types'

export const agentKeys = {
  all:    ['agents'] as const,
  detail: (id: string) => ['agents', id] as const,
}

export function useAgents() {
  return useQuery({ queryKey: agentKeys.all, queryFn: agentsApi.list })
}

export function useAgent(id: string) {
  return useQuery({ queryKey: agentKeys.detail(id), queryFn: () => agentsApi.get(id), enabled: !!id })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateAgentPayload) => agentsApi.create(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  })
}

export function useUpdateAgent(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateAgentPayload) => agentsApi.update(id, p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: agentKeys.all })
      qc.invalidateQueries({ queryKey: agentKeys.detail(id) })
    },
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentKeys.all }),
  })
}

// Runtime-side (FR-D4-001) — whether the app has an enabled Agent, backing
// the floating launcher's visibility. `enabled` is a plain passthrough
// boolean the CALLER computes (e.g. `!!session`), not something this hook
// checks internally — mirrors useUnreadCount's identical signature
// convention (features/runtime/notifications/hooks.ts) so anonymous Runtime
// visitors never fire a request that would 401.
export function useLauncherStatus(enabled: boolean) {
  return useQuery({
    queryKey: [...agentKeys.all, 'launcher-status'] as const,
    queryFn:  agentsApi.launcherStatus,
    enabled,
    // No live re-check while mounted (FR-D4-001 v0.2's resolved mid-session
    // decision: an Agent disabled while a user has the launcher open is not
    // live-invalidated) — this only re-fetches on a fresh mount, i.e. a full
    // Runtime app load, matching FR-D1-006's own once-per-route-entry
    // refresh precedent.
    staleTime: Infinity,
  })
}
