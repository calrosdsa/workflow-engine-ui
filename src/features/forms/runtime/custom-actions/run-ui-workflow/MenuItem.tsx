// The run_ui_workflow action's dispatch: the first place a UI workflow
// actually executes.
//
// Unlike trigger_workflow next door, nothing here is dispatched to a server
// and polled — the steps run in this tab, against this record, as this viewer.
// What that buys is immediacy (no 202-then-poll for a two-step flow) and what
// it costs is durability: navigate away mid-run and the rest never happens,
// with whatever already wrote staying written. That trade is the whole point
// of the feature, and the run_workflow step exists for the cases where it is
// the wrong trade.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useQueryClient } from '@tanstack/react-query'
import { runUiWorkflow } from '@/features/ui-workflows/interpreter'
import { useUiWorkflowHost } from '@/features/ui-workflows/useUiWorkflowHost'
import { emptyRunContext } from '@/features/ui-workflows/host'
import type { CustomActionMenuItemProps } from '../contract'
import type { RunUiWorkflowActionConfig } from './schema'

export function RunUiWorkflowMenuItem({
  formId,
  recordId,
  record,
  config,
  label,
  onDone,
}: CustomActionMenuItemProps<RunUiWorkflowActionConfig>) {
  const [pending, setPending] = useState(false)
  const qc = useQueryClient()
  const abortRef = useRef<AbortController | null>(null)

  const host = useUiWorkflowHost({
    // A workflow that writes has to make the record it wrote to look written;
    // the host cannot know which query that is, this component does.
    onRefresh: () => void qc.invalidateQueries({ queryKey: ['forms', formId] }),
  })

  // A half-configured action (added but never given steps) is omitted rather
  // than offered as a menu entry that does nothing — the same "incomplete
  // config -> omit" convention update_field and trigger_workflow follow.
  if (config.workflow.steps.length === 0) return null

  const run = async () => {
    if (pending) return
    setPending(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await runUiWorkflow({
        steps: config.workflow.steps,
        // The record is passed as the condition/field source, so a step can
        // branch on what is on screen without fetching anything.
        ctx: emptyRunContext({ formId, recordId, record: record as Record<string, unknown> }),
        host,
        signal: controller.signal,
      })

      // Only failures are announced. A completed run said whatever it meant to
      // say through its own show_message steps, and adding a generic "done"
      // on top would talk over the author.
      if (result.status === 'failed') {
        toast.error(`"${label}" couldn't finish`, { description: result.error })
      }
    } catch (e) {
      // runUiWorkflow is contractually total; this is the belt to that braces,
      // because an unhandled rejection in a click handler is invisible.
      toast.error(`"${label}" couldn't finish`, {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setPending(false)
      abortRef.current = null
      onDone?.()
    }
  }

  return (
    <DropdownMenuItem disabled={pending} onClick={run}>
      {label}
    </DropdownMenuItem>
  )
}
