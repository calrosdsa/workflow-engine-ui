/** The command palette's stable vocabulary. UI layers supply the actual
 * handlers, so commands stay discoverable without coupling this model to a
 * canvas instance or a page-level mutation. */
export type WorkflowCommandId =
  | 'add-step' | 'fit-view' | 'tidy-layout' | 'toggle-minimap'
  | 'toggle-variables' | 'toggle-inspector' | 'toggle-executions' | 'close-panels'
  | 'open-setup' | 'save-workflow' | 'run-workflow' | 'open-lifecycle' | 'checkpoint'

export interface WorkflowCommandDefinition {
  id: WorkflowCommandId
  group: 'Canvas' | 'Navigate' | 'Workflow'
  label: string
  keywords: string
  shortcut?: string
}

export const WORKFLOW_COMMANDS: readonly WorkflowCommandDefinition[] = [
  { id: 'add-step', group: 'Canvas', label: 'Add workflow step', keywords: 'new node action', shortcut: 'Enter' },
  { id: 'fit-view', group: 'Canvas', label: 'Fit workflow to view', keywords: 'zoom canvas' },
  { id: 'tidy-layout', group: 'Canvas', label: 'Tidy workflow layout', keywords: 'arrange horizontal dagre', shortcut: 'Ctrl+Shift+L' },
  { id: 'toggle-minimap', group: 'Canvas', label: 'Toggle minimap', keywords: 'map overview' },
  { id: 'toggle-variables', group: 'Navigate', label: 'Toggle variables', keywords: 'context values panel' },
  { id: 'toggle-inspector', group: 'Navigate', label: 'Toggle node inspector', keywords: 'config parameters panel' },
  { id: 'toggle-executions', group: 'Navigate', label: 'Open execution inspector', keywords: 'runs history status' },
  { id: 'close-panels', group: 'Navigate', label: 'Close editor panels', keywords: 'canvas focus' },
  { id: 'open-setup', group: 'Workflow', label: 'Open workflow setup', keywords: 'requirements incomplete focus' },
  { id: 'save-workflow', group: 'Workflow', label: 'Save workflow', keywords: 'draft definition', shortcut: 'Ctrl+S' },
  { id: 'run-workflow', group: 'Workflow', label: 'Run workflow', keywords: 'execute test' },
  { id: 'open-lifecycle', group: 'Workflow', label: 'Open lifecycle and publish', keywords: 'version release active' },
  { id: 'checkpoint', group: 'Workflow', label: 'Review checkpoint and version history', keywords: 'save version commit' },
]

export const WORKFLOW_COMMAND_EVENT = 'workflow-command'
const RECENT_KEY = 'workflow-editor-recent-commands'

export function dispatchWorkflowCommand(id: WorkflowCommandId) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<WorkflowCommandId>(WORKFLOW_COMMAND_EVENT, { detail: id }))
}

export function recentWorkflowCommandIds(): WorkflowCommandId[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const valid = new Set(WORKFLOW_COMMANDS.map((command) => command.id))
    return parsed.filter((id): id is WorkflowCommandId => typeof id === 'string' && valid.has(id as WorkflowCommandId))
  } catch { return [] }
}

export function rememberWorkflowCommand(id: WorkflowCommandId) {
  if (typeof window === 'undefined') return
  try {
    const next = [id, ...recentWorkflowCommandIds().filter((recent) => recent !== id)].slice(0, 5)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* Storage can be disabled; command execution still works. */ }
}
