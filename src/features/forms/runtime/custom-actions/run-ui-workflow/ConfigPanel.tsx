import { useMemo } from 'react'
import { UiWorkflowEditor } from '@/features/ui-workflows/UiWorkflowEditor'
import { projectToFields } from '@/features/form-builder/projection'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { CustomActionConfigPanelProps } from '../contract'
import type { RunUiWorkflowActionConfig } from './schema'

export function RunUiWorkflowConfigPanel({
  config,
  onChange,
  schema,
}: CustomActionConfigPanelProps<RunUiWorkflowActionConfig>) {
  const t = useTranslation()
  // This form's own fields, so condition builders and field pickers offer real
  // names instead of asking someone to type keys from memory.
  const fields = useMemo(() => (schema ? projectToFields(schema).fields : []), [schema])

  return (
    <UiWorkflowEditor
      value={config.workflow}
      onChange={(workflow) => onChange({ workflow })}
      fields={fields}
      help={t('run_ui_workflow.config.help')}
    />
  )
}
