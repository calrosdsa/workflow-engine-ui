import { UiWorkflowJsonEditor } from '@/features/ui-workflows/UiWorkflowJsonEditor'
import type { CustomActionConfigPanelProps } from '../contract'
import type { RunUiWorkflowActionConfig } from './schema'

export function RunUiWorkflowConfigPanel({
  config,
  onChange,
}: CustomActionConfigPanelProps<RunUiWorkflowActionConfig>) {
  return (
    <UiWorkflowJsonEditor
      value={config.workflow}
      onChange={(workflow) => onChange({ workflow })}
      help="Runs in the viewer’s browser when they pick this action, with this record in context."
    />
  )
}
