// Skill mirrors api/agents/handler.go's `skill` type exactly (FR-C8-002).
// An empty allowed_tools means "no restriction" — the Skill inherits the
// Agent's full tool set, per FR-C8-002 §8's resolved reading.
export interface Skill {
  name: string
  description: string
  allowed_tools: string[]
  instructions: string
}

export interface Agent {
  id: string
  app_id: string
  name: string
  description: string
  instructions: string
  // provider_id identifies which Instance (credential/vendor) this Agent
  // calls; model_id identifies which specific model on that Instance — the
  // Model Providers screen's Instance/Model split (an Instance can expose
  // several models now, model_id is the one this Agent actually uses).
  provider_id: string
  model_id: string
  skills: Skill[]
  enabled: boolean
  // session_ttl_days overrides the platform-wide default retention window
  // (FR-F6-003) — null means "use the platform default," not "retain
  // forever."
  session_ttl_days: number | null
  created_at: string
  updated_at: string
}

export interface CreateAgentPayload {
  name: string
  model_id: string
}

export interface UpdateAgentPayload {
  name: string
  description: string
  instructions: string
  skills: Skill[]
  enabled: boolean
  session_ttl_days: number | null
}
