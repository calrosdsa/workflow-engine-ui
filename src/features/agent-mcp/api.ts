import { api } from '@/lib/api'
import type { MCPServer, RegisterMCPServerPayload } from './types'

// Mirrors api/agentmcp's 5 routes (FR-C8-003), nested under the owning Agent.
export const agentMCPApi = {
  list:     (agentId: string) => api.get(`agents/${agentId}/mcp-servers`).json<MCPServer[]>(),
  register: (agentId: string, p: RegisterMCPServerPayload) =>
    api.post(`agents/${agentId}/mcp-servers`, { json: p }).json<MCPServer>(),
  refresh:  (agentId: string, id: string) =>
    api.post(`agents/${agentId}/mcp-servers/${id}/refresh`).json<MCPServer>(),
  setToolEnabled: (agentId: string, id: string, toolName: string, enabled: boolean) =>
    api.post(`agents/${agentId}/mcp-servers/${id}/tools/${encodeURIComponent(toolName)}`, { json: { enabled } }).json<MCPServer>(),
  delete: (agentId: string, id: string) => api.delete(`agents/${agentId}/mcp-servers/${id}`),
}
