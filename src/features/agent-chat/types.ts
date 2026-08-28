// Wire shapes mirroring api/agentchat/handler.go's sessionResponse/
// messageResponse/wsTokenResponse exactly (FR-D4-002).

export interface ChatSession {
  id: string
  agent_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  role: string
  content: string
  tool_calls?: PendingConfirmation[] | unknown
  tool_results?: unknown
  created_at: string
}

// agent_messages.tool_calls' shape for an always_confirm tool call awaiting
// (or resolved by) a human decision — mirrors
// internal/agents.pendingConfirmationPayload exactly (FR-F6-002/FR-D4-002).
// A message carries this shape (rather than plain text) when the Agent
// wants to run a tool that requires explicit approval before it proceeds.
export interface PendingConfirmation {
  name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied'
}

export interface WSTokenResponse {
  token: string
  expires_in: number
  ws_url: string
  channel: string
}

export interface SendMessageResult {
  outcome: string
}
