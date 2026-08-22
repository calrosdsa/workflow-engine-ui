// The trigger_workflow custom action's actual dispatch (FR-D2-017 §3/§4,
// FR-B3-007's on_demand_data_driven design) — on click, calls the new
// POST /forms/{form_id}/records/{record_id}/trigger-workflow endpoint with
// the current form/record, which the backend hands to the workflow run
// UNMASKED as every field on Vars["fieldKey"] (FR-B3-007 §5/§8's explicit
// v0.4 decision — this run sees the same full record before/after/
// after_async workflows already see, not the caller's own masked view).
// Failure/success surfaced via the same sonner toast convention
// RecordDetailToolbar's own Delete/account actions and update_field
// already use — not a new UI treatment.
import { useState } from 'react'
import { toast } from 'sonner'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { formsApi } from '@/features/forms/api'
import type { CustomActionMenuItemProps } from '../contract'
import type { TriggerWorkflowActionConfig } from './schema'

export function TriggerWorkflowMenuItem({ formId, recordId, config, label, onDone }: CustomActionMenuItemProps<TriggerWorkflowActionConfig>) {
  const [pending, setPending] = useState(false)

  // No configured workflow yet (an action added but never finished being
  // configured) — omit rather than dispatch with an empty id, mirroring
  // update_field's identical "stale/incomplete config -> omit" convention
  // (FR-D2-017 §6's first edge-case row) for consistency across both action
  // types, even though this isn't technically a STALE reference here.
  if (!config.workflowDefinitionId) return null

  const run = async () => {
    if (pending) return
    setPending(true)
    try {
      await formsApi.triggerWorkflow(formId, recordId, config.workflowDefinitionId)
      toast.success('Workflow started')
      onDone?.()
    } catch (e) {
      toast.error('Failed to start workflow', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenuItem disabled={pending} onClick={run}>
      {label}
    </DropdownMenuItem>
  )
}
