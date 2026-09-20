import { api } from '@/lib/api'
import type { ChatSession, ChatMessage, WSTokenResponse, SendMessageResult } from './types'

// Thin wrapper over api/agentchat's Chat routes (FR-D4-002) — mirrors
// features/agents/api.ts's shape (flat route names, .json<T>() per call).
//
// listSessions/listMessages unwrap the `{sessions/messages, total, page,
// page_size}` pagination envelope the backend now returns (see
// api/agentchat.Handler.ListSessions/ListMessages) back down to a plain
// array, so every existing caller here keeps seeing the same
// ChatSession[]/ChatMessage[] it always has. This is a page-1-only view —
// callers wanting page 2+ or the total count need their own paginated hook,
// not built yet.
export const agentChatApi = {
  listSessions:  () => api.get('agent-chat/sessions').json<{ sessions: ChatSession[] }>().then(r => r.sessions),
  createSession: () => api.post('agent-chat/sessions', { json: {} }).json<ChatSession>(),
  renameSession: (id: string, title: string) =>
    api.post(`agent-chat/sessions/${id}/rename`, { json: { title } }).json<{ ok: boolean }>(),
  deleteSession: (id: string) => api.delete(`agent-chat/sessions/${id}`),
  listMessages:  (id: string) =>
    api.get(`agent-chat/sessions/${id}/messages`).json<{ messages: ChatMessage[] }>().then(r => r.messages),
  sendMessage:   (id: string, content: string) =>
    api.post(`agent-chat/sessions/${id}/messages`, { json: { content } }).json<SendMessageResult>(),
  confirm:       (id: string, callId: string, approved: boolean) =>
    api.post(`agent-chat/sessions/${id}/ui-actions/${encodeURIComponent(`confirm:${callId}`)}`, {
      json: { action_id: approved ? 'approve' : 'deny' },
    }).json<{ ok: boolean; surface_id: string; state: string }>(),
  mintWSToken:   (id: string) => api.post(`agent-chat/sessions/${id}/ws-token`).json<WSTokenResponse>(),
}
