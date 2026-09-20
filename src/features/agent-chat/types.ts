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
  ui?: ChatSurface
  created_at: string
}

export type ChatSurface = ConfirmSurface | FormSurface | ChoiceSurface

export interface ConfirmSurface {
  kind: 'confirm'
  id: string
  version?: 1
  state?: 'open' | 'pending' | 'resolved' | 'expired'
  call_id: string
  title: string
  description?: string
  allowed_actions?: string[]
  expires_at?: string
  run_id?: string
  approval_id?: string
  status?: 'pending' | 'approved' | 'denied' | 'expired'
  tool_name?: string
  arguments?: Record<string, unknown>
}

export interface FormSurface {
  kind: 'form'
  id: string
  version?: 1
  state?: 'open' | 'pending' | 'submitted' | 'resolved' | 'expired'
  title: string
  description?: string
  allowed_actions?: string[]
  expires_at?: string
  run_id?: string
  call_id?: string
  fields: Array<{ name: string; label: string; type: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime'; description?: string; required?: boolean }>
}

export interface ChoiceSurface {
  kind: 'choice'
  id: string
  version?: 1
  state?: 'open' | 'pending' | 'submitted' | 'resolved' | 'expired'
  title: string
  description?: string
  allowed_actions?: string[]
  expires_at?: string
  run_id?: string
  call_id?: string
  options: Array<{ value: string; label: string; description?: string }>
}

// agent_messages.tool_calls' shape for an always_confirm tool call awaiting
// (or resolved by) a human decision — mirrors
// internal/agents.pendingConfirmationPayload exactly (FR-F6-002/FR-D4-002).
// A message carries this shape (rather than plain text) when the Agent
// wants to run a tool that requires explicit approval before it proceeds.
export interface PendingConfirmation {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied' | 'expired'
  run_id?: string
  approval_id?: string
}

export interface WSTokenResponse {
  token: string
  expires_in: number
  ws_url: string
  channel: string
}

export interface SendMessageResult {
  outcome: string
  run_id?: string
  status?: 'queued' | 'running' | 'waiting_for_input' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'budget_exceeded'
}

export interface AgentRun {
  id: string
  agent_id: string
  session_id?: string
  origin: string
  status: 'queued' | 'running' | 'waiting_for_input' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'budget_exceeded'
  outcome?: string
  error?: string
  started_at: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface AgentRunEvent {
  id: string
  run_id: string
  sequence: number
  type: string
  payload: unknown
  created_at: string
}

export interface AgentUISurfaceResponse {
  surface: ChatSurface
  state: ChatSurface['state']
  submitted_payload?: unknown
  actor_id?: string
  updated_at: string
}
