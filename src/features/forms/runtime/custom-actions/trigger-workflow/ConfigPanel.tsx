// Config surface for the trigger_workflow custom action type (FR-D2-017) —
// a workflow-definition picker restricted to workflows whose own Trigger
// node is configured Mode: on_demand_data_driven (FR-B3-007), and whose
// SourceFormID (if set) matches this action's own owning form — the same
// "restrict the picker to only legal choices" precedent related_form's
// target-field picker (FR-D2-015) already established, rather than letting
// an admin pick a workflow that would 422 at click time.
import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useWorkflows } from '@/features/workflows/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { CustomActionConfigPanelProps } from '../contract'
import type { TriggerWorkflowActionConfig } from './schema'
import type { GraphNode, TriggerConfig, WorkflowDefinition } from '@/features/workflows/types'

/** Finds a workflow's one Trigger node and parses its Configuration —
 *  mirrors api/forms/handler.go's findTriggerConfig exactly (every saved
 *  Definition has exactly one Trigger node, graph validation enforces this
 *  at save time). Returns undefined for a malformed/missing trigger rather
 *  than throwing — a stale or hand-edited definition should just be
 *  filtered out of the picker, not crash it. */
function triggerConfigOf(wf: WorkflowDefinition): TriggerConfig | undefined {
  const node = wf.definition.nodes.find((n: GraphNode) => n.type === 'trigger')
  if (!node) return undefined
  const cfg = node.configuration as Partial<TriggerConfig> | undefined
  if (!cfg || cfg.mode !== 'on_demand_data_driven') return undefined
  return cfg as TriggerConfig
}

export function TriggerWorkflowConfigPanel({ config, onChange, formId }: CustomActionConfigPanelProps<TriggerWorkflowActionConfig>) {
  const t = useTranslation()
  const { data: workflows } = useWorkflows()

  const eligible = useMemo(() => {
    if (!workflows) return []
    return workflows.filter((wf) => {
      const trig = triggerConfigOf(wf)
      if (!trig) return false
      return !trig.source_form_id || trig.source_form_id === formId
    })
  }, [workflows, formId])

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('trigger_workflow.config.workflow_label')}</Label>
      <SelectMenu
        value={config.workflowDefinitionId}
        onValueChange={(workflowDefinitionId) => onChange({ ...config, workflowDefinitionId })}
      >
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('trigger_workflow.config.choose_workflow_placeholder')} /></SelectTrigger>
        <SelectContent>
          {eligible.length === 0 ? (
            <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
              {t('trigger_workflow.config.no_eligible_workflows')}
            </div>
          ) : (
            eligible.map((wf) => (
              <SelectItem key={wf.id} value={wf.id} className="text-xs">{wf.name}</SelectItem>
            ))
          )}
        </SelectContent>
      </SelectMenu>
    </div>
  )
}
