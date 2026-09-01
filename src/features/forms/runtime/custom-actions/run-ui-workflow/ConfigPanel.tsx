import { useMemo } from 'react'
import { UiWorkflowEditor } from '@/features/ui-workflows/UiWorkflowEditor'
import { projectToFields } from '@/features/form-builder/projection'
import type { CustomActionConfigPanelProps } from '../contract'
import type { RunUiWorkflowActionConfig } from './schema'

export function RunUiWorkflowConfigPanel({
  config,
  onChange,
  schema,
}: CustomActionConfigPanelProps<RunUiWorkflowActionConfig>) {
  // This form's own fields, so condition builders and field pickers offer real
  // names instead of asking someone to type keys from memory.
  const fields = useMemo(() => (schema ? projectToFields(schema).fields : []), [schema])

  return (
    <UiWorkflowEditor
      value={config.workflow}
      onChange={(workflow) => onChange({ workflow })}
      fields={fields}
      help="Runs in the viewer’s browser when they pick this action, with this record in context."
    />
  )
}
