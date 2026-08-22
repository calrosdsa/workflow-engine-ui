export interface TriggerWorkflowActionConfig {
  workflowDefinitionId: string
}

export function emptyTriggerWorkflowActionConfig(): TriggerWorkflowActionConfig {
  return { workflowDefinitionId: '' }
}

/** Defensive parse — mirrors update_field's parseUpdateFieldActionConfig and
 *  DetailTabDefinition.parseConfig's shared "never throw, heal a malformed/
 *  stale blob" contract. */
export function parseTriggerWorkflowActionConfig(raw: unknown): TriggerWorkflowActionConfig {
  const empty = emptyTriggerWorkflowActionConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    workflowDefinitionId: typeof r.workflowDefinitionId === 'string' ? r.workflowDefinitionId : empty.workflowDefinitionId,
  }
}
