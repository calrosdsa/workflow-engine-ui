// The trigger_workflow custom action's actual dispatch (FR-D2-017 §3/§4,
// FR-B3-007's on_demand_data_driven design) — on click, calls the new
// POST /forms/{form_id}/records/{record_id}/trigger-workflow endpoint with
// the current form/record, which the backend hands to the workflow run
// UNMASKED as every field on Vars["fieldKey"] (FR-B3-007 §5/§8's explicit
// v0.4 decision — this run sees the same full record before/after/
// after_async workflows already see, not the caller's own masked view).
//
// The dispatch call itself only returns 202/PENDING — the workflow keeps
// running after that response lands. So a single "started" toast
// understates what's happening for anything but an instant run: this polls
// executionsApi.get (the same shape useExecution's 2s poll uses, inlined
// as a plain loop rather than mounted as a query — this component is a
// one-shot click handler in an ephemeral dropdown, not a persistent view
// anything else needs to read from cache) and keeps ONE toast.loading(...)
// live, updated in place via its id, until the run reaches a terminal
// status — matching sonner's own id-based update convention rather than
// stacking a second toast on top of the first. Copy names the action's own
// configured label ("Send to Legal"), not "workflow"/"execution" — the
// viewer clicked a named action, not a workflow engine concept.
//
// A completed run's own Show Message output (execution.messages — see
// engine.MessageOutput backend-side) takes priority over the generic
// "<label> is done" copy when present: the workflow author wrote that
// message specifically for whoever triggers it, so it's a more specific
// signal than this component's own fallback. Show Message now always halts
// the run once it fires (engine/workflow.go), so a COMPLETED execution has
// at most the one message that ended it — using the LAST entry in
// `messages` is defensive (a run with no Show Message node has none; this
// only matters if that invariant ever loosens). Its own message_type
// ('success'/'error'/'info') picks the toast variant too — an author who
// built an error-type message wants it to read as an error even though the
// run itself still completed successfully (Show Message halting is not a
// failure).
import { useState } from 'react'
import { toast } from 'sonner'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { formsApi } from '@/features/forms/api'
import { executionsApi } from '@/features/executions/api'
import type { CustomActionMenuItemProps } from '../contract'
import type { TriggerWorkflowActionConfig } from './schema'
import type { ExecutionMessage } from '@/features/executions/types'

const POLL_INTERVAL_MS = 2000

function firstNodeError(nodeErrors: Record<string, string> | undefined): string | undefined {
  if (!nodeErrors) return undefined
  return Object.values(nodeErrors)[0]
}

function lastMessage(messages: ExecutionMessage[] | undefined): ExecutionMessage | undefined {
  return messages && messages.length > 0 ? messages[messages.length - 1] : undefined
}

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
    // Copy speaks to the action the viewer clicked (its configured label),
    // not backend vocabulary like "workflow"/"execution" — a viewer doesn't
    // necessarily know or care that this action is backed by a workflow.
    const toastId = toast.loading(`Running "${label}"…`)
    try {
      const { execution_id } = await formsApi.triggerWorkflow(formId, recordId, config.workflowDefinitionId)
      onDone?.()

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const execution = await executionsApi.get(execution_id)
        if (execution.status === 'COMPLETED') {
          const msg = lastMessage(execution.messages)
          if (msg) {
            const toastFn = msg.message_type === 'error' ? toast.error : msg.message_type === 'info' ? toast.info : toast.success
            toastFn(msg.message, { id: toastId })
          } else {
            toast.success(`"${label}" is done`, { id: toastId })
          }
          break
        }
        if (execution.status === 'FAILED' || execution.status === 'CANCELLED') {
          toast.error(execution.status === 'FAILED' ? `"${label}" ran into a problem` : `"${label}" was cancelled`, {
            id: toastId,
            description: firstNodeError(execution.node_errors),
          })
          break
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    } catch (e) {
      toast.error(`Couldn't start "${label}"`, { id: toastId, description: e instanceof Error ? e.message : undefined })
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
