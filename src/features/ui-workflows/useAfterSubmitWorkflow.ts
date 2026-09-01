// Runs a form's afterSubmitWorkflow once a record has been saved.
//
// AFTER the write, and unable to stop it. By the time these steps run the
// record exists, so a failure reports and halts the remaining steps without
// undoing anything — there is no rollback and none is implied. A veto would
// mean a browser deciding whether a write is allowed, which the server has to
// re-decide regardless; the form's own Before triggers are where that belongs.
//
// Returns a function rather than doing the wiring itself because the save
// lives in the CALLER (AddMenuRuntime, RuntimeFormCreatePage), not in
// FormRenderer — FormRenderer hands values up and never learns whether they
// landed.
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { runUiWorkflow } from './interpreter'
import { useUiWorkflowHost } from './useUiWorkflowHost'
import { emptyRunContext } from './host'
import type { UiWorkflow } from './types'

export interface AfterSubmitResult {
  /** True when a step navigated away. The caller's own post-save redirect
   *  must stand down in that case: two navigations racing on one click leaves
   *  the viewer wherever the second one happens to land, which is arbitrary.
   *  The workflow is the more specific instruction, so it wins. */
  navigated: boolean
}

export function useAfterSubmitWorkflow(formId: string | undefined, workflow: UiWorkflow | undefined) {
  const qc = useQueryClient()
  const navigatedRef = useRef(false)

  const host = useUiWorkflowHost({
    onRefresh: () => {
      if (formId) void qc.invalidateQueries({ queryKey: ['forms', formId] })
    },
    onNavigate: () => {
      navigatedRef.current = true
    },
  })

  return useCallback(
    async (saved: { id?: unknown } & Record<string, unknown>): Promise<AfterSubmitResult> => {
      navigatedRef.current = false
      const steps = workflow?.steps ?? []
      if (steps.length === 0 || !formId) return { navigated: false }

      const recordId = saved.id === undefined || saved.id === null ? undefined : String(saved.id)
      const result = await runUiWorkflow({
        steps,
        // The just-saved record IS the context, so a step can branch on what
        // was entered and update_record can address it with no configuration.
        ctx: emptyRunContext({ formId, recordId, record: saved }),
        host,
      })

      // Only failures are announced. A run that completed already said
      // whatever it meant to say through its own show_message steps, and the
      // caller shows its own "saved" confirmation besides.
      if (result.status === 'failed') {
        toast.error('The record was saved, but the follow-up steps did not finish.', {
          description: result.error,
        })
      }
      return { navigated: navigatedRef.current }
    },
    [formId, workflow, host],
  )
}
