import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentChatApi } from './api'

export const agentChatKeys = {
  sessions: ['agent-chat', 'sessions'] as const,
  messages: (sessionId: string) => ['agent-chat', 'sessions', sessionId, 'messages'] as const,
}

// enabled gates every hook below on session presence — same convention as
// useLauncherStatus/useUnreadCount, since the ChatLauncher only ever mounts
// this feature for an authenticated user.

export function useChatSessions(enabled: boolean) {
  return useQuery({
    queryKey: agentChatKeys.sessions,
    queryFn:  agentChatApi.listSessions,
    enabled,
  })
}

export function useCreateChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: agentChatApi.createSession,
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentChatKeys.sessions }),
  })
}

export function useRenameChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => agentChatApi.renameSession(id, title),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentChatKeys.sessions }),
  })
}

export function useDeleteChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => agentChatApi.deleteSession(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentChatKeys.sessions }),
  })
}

// Messages are seeded once via this query, then kept current by appending
// live Centrifugo publications directly into the query cache (see
// useAgentChatSocket) rather than refetching — matches this session's own
// resolved decision that the Agent's reply arrives over the socket, not the
// POST /messages response body.
export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: agentChatKeys.messages(sessionId ?? ''),
    queryFn:  () => agentChatApi.listMessages(sessionId!),
    enabled:  !!sessionId,
  })
}

export function useSendChatMessage(sessionId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => agentChatApi.sendMessage(sessionId!, content),
    onSuccess:  () => qc.invalidateQueries({ queryKey: agentChatKeys.messages(sessionId ?? '') }),
  })
}

export function useConfirmChatToolCall(sessionId: string | null) {
  return useMutation({
    mutationFn: ({ callId, approved }: { callId: string; approved: boolean }) => agentChatApi.confirm(sessionId!, callId, approved),
  })
}
