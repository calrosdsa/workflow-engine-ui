import { parseUiWorkflow } from '@/features/ui-workflows/parse'
import { emptyUiWorkflow, type UiWorkflow } from '@/features/ui-workflows/types'

/** The graph is stored INSIDE this action's config rather than referenced by
 *  id — the embedding decision from the schema phase. It needs no table, no
 *  migration and no API, because a custom action's config is already opaque
 *  JSON to the backend. */
export interface RunUiWorkflowActionConfig {
  workflow: UiWorkflow
}

export function emptyRunUiWorkflowActionConfig(): RunUiWorkflowActionConfig {
  return { workflow: emptyUiWorkflow() }
}

/** Defensive parse — the shared "never throw, heal a malformed/stale blob"
 *  contract. Delegates the interesting half to parseUiWorkflow, which is
 *  already total. */
export function parseRunUiWorkflowActionConfig(raw: unknown): RunUiWorkflowActionConfig {
  if (!raw || typeof raw !== 'object') return emptyRunUiWorkflowActionConfig()
  return { workflow: parseUiWorkflow((raw as Record<string, unknown>).workflow) }
}
