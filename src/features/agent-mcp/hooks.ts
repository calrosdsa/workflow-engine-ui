import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentMCPApi } from './api'
import type { RegisterMCPServerPayload } from './types'

export const agentMCPKeys = {
  list: (agentId: string) => ['agent-mcp-servers', agentId] as const,
}

export function useMCPServers(agentId: string) {
  return useQuery({
    queryKey: agentMCPKeys.list(agentId),
    queryFn:  () => agentMCPApi.list(agentId),
    enabled:  !!agentId,
  })
}

export function useRegisterMCPServer(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: RegisterMCPServerPayload) => agentMCPApi.register(agentId, p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentMCPKeys.list(agentId) }),
  })
}

export function useRefreshMCPServer(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => agentMCPApi.refresh(agentId, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentMCPKeys.list(agentId) }),
  })
}

export function useSetMCPToolEnabled(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, toolName, enabled }: { id: string; toolName: string; enabled: boolean }) =>
      agentMCPApi.setToolEnabled(agentId, id, toolName, enabled),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentMCPKeys.list(agentId) }),
  })
}

export function useDeleteMCPServer(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => agentMCPApi.delete(agentId, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentMCPKeys.list(agentId) }),
  })
}
