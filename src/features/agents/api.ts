import { api } from '@/lib/api'
import type { Agent, CreateAgentPayload, UpdateAgentPayload } from './types'

export const agentsApi = {
  list:   () => api.get('agents').json<Agent[]>(),
  get:    (id: string) => api.get(`agents/${id}`).json<Agent>(),
  create: (p: CreateAgentPayload) => api.post('agents', { json: p }).json<Agent>(),
  update: (id: string, p: UpdateAgentPayload) => api.put(`agents/${id}`, { json: p }).json<Agent>(),
  delete: (id: string) => api.delete(`agents/${id}`),
  // Runtime-side check (FR-D4-001) — any authenticated user, not gated by
  // assistant:read like the four calls above. Deliberately its own tiny
  // endpoint/call, not List: see api/agents.Handler.LauncherStatus's own
  // doc comment for why.
  launcherStatus: () => api.get('agents/launcher-status').json<{ enabled: boolean }>(),
}
