import { api } from '@/lib/api'
import type { ChatSession, ChatMessage, WSTokenResponse, SendMessageResult } from './types'

// Thin wrapper over api/agentchat's 8 routes (FR-D4-002) — mirrors
// features/agents/api.ts's shape (flat route names, .json<T>() per call).
export const agentChatApi = {
  listSessions:  () => api.get('agent-chat/sessions').json<ChatSession[]>(),
  createSession: () => api.post('agent-chat/sessions', { json: {} }).json<ChatSession>(),
  renameSession: (id: string, title: string) =>
    api.post(`agent-chat/sessions/${id}/rename`, { json: { title } }).json<{ ok: boolean }>(),
  deleteSession: (id: string) => api.delete(`agent-chat/sessions/${id}`),
  listMessages:  (id: string) => api.get(`agent-chat/sessions/${id}/messages`).json<ChatMessage[]>(),
  sendMessage:   (id: string, content: string) =>
    api.post(`agent-chat/sessions/${id}/messages`, { json: { content } }).json<SendMessageResult>(),
  confirm:       (id: string, approved: boolean) =>
    api.post(`agent-chat/sessions/${id}/confirm`, { json: { approved } }).json<{ ok: boolean }>(),
  mintWSToken:   (id: string) => api.post(`agent-chat/sessions/${id}/ws-token`).json<WSTokenResponse>(),
}
