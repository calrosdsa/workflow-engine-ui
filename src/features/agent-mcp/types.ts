// Wire shapes mirroring api/agentmcp/handler.go's serverResponse exactly
// (FR-C8-003).

export interface MCPTool {
  name: string
  description: string
  enabled: boolean
}

export interface MCPServer {
  id: string
  agent_id: string
  name: string
  url: string
  has_token: boolean
  tools: MCPTool[]
  last_refreshed_at: string
  created_at: string
  updated_at: string
}

export interface RegisterMCPServerPayload {
  name: string
  url: string
  token?: string
}
