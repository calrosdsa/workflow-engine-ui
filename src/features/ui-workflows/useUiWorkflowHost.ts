// The real UiWorkflowHost: the one place the interpreter's abstract
// capabilities get wired to sonner, TanStack Router and formsApi.
//
// Kept out of the interpreter deliberately (see host.ts) — this file is the
// only part of the feature that cannot run under a plain unit test, so it is
// also the only part kept as thin as possible.
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { formsApi } from '@/features/forms/api'
import { executionsApi } from '@/features/executions/api'
import type { UiMessageType, UiWorkflowHost } from './host'

const POLL_INTERVAL_MS = 2000

function showToast(text: string, type: UiMessageType) {
  if (type === 'error') return void toast.error(text)
  if (type === 'success') return void toast.success(text)
  if (type === 'warning') return void toast.warning(text)
  toast.info(text)
}

export interface UseUiWorkflowHostOptions {
  /** Called after a step writes or a `refresh` step runs, so the surface that
   *  owns the data can re-fetch. The host cannot know which query to
   *  invalidate; the caller does. */
  onRefresh?: () => void
}

/** Builds a host bound to the current route.
 *
 *  Route params are read non-strictly on purpose: this same toolbar renders
 *  under BOTH routers (the builder's preview and the runtime), and only the
 *  runtime has clientId/appId to navigate with. Rather than pretend, a
 *  navigate step in a surface with no runtime route reports honestly instead
 *  of silently going nowhere. */
export function useUiWorkflowHost({ onRefresh }: UseUiWorkflowHostOptions = {}): UiWorkflowHost {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { clientId?: string; appId?: string }
  const { clientId, appId } = params

  const refresh = useCallback(() => { onRefresh?.() }, [onRefresh])

  return useMemo<UiWorkflowHost>(() => ({
    showMessage: showToast,

    navigate: (target) => {
      if (target.kind === 'back') {
        window.history.back()
        return
      }
      if (!clientId || !appId) {
        throw new Error('This step can only navigate inside the runtime app.')
      }
      if (target.kind === 'menu') {
        void navigate({ to: `/${clientId}/${appId}/${target.slug}` })
        return
      }
      void navigate({ to: `/${clientId}/${appId}/forms/${target.formId}/${target.recordId}` })
    },

    refresh,

    searchRecords: async (req) => {
      const result = await formsApi.searchRecords(req.formId, {
        filter: req.filter,
        sort: req.sort,
        page: 1,
        page_size: req.pageSize,
      })
      return { records: result.records, total: result.total }
    },

    createRecord: async (formId, values) => {
      const created = await formsApi.createRecord(formId, values)
      onRefresh?.()
      return { id: String((created as { id?: unknown }).id ?? '') }
    },

    updateRecord: async (formId, recordId, values) => {
      await formsApi.updateRecord(formId, recordId, values)
      onRefresh?.()
    },

    runServerWorkflow: async ({ formId, recordId, workflowDefinitionId, wait }) => {
      const { execution_id } = await formsApi.triggerWorkflow(formId, recordId, workflowDefinitionId)
      // Dispatch only returns 202 — the run keeps going after this resolves.
      // Not waiting is the default precisely because a durable workflow can
      // outlive the screen that started it.
      if (!wait) return { status: 'PENDING' }

      // Polls the same way the trigger_workflow record action already does.
      // Deliberately unbounded in time but bound by the run's own AbortSignal
      // upstream: a workflow that never finishes is the server's problem to
      // report, not something to invent a timeout for here.
      for (;;) {
        const execution = await executionsApi.get(execution_id)
        if (execution.status === 'COMPLETED') {
          const last = execution.messages?.[execution.messages.length - 1]
          return {
            status: execution.status,
            message: last?.message,
            messageType: last?.message_type as UiMessageType | undefined,
          }
        }
        if (execution.status === 'FAILED' || execution.status === 'CANCELLED') {
          // Surfaced as a step failure, which stops the run — a workflow that
          // failed is not a result later steps should build on.
          throw new Error(
            Object.values(execution.node_errors ?? {})[0] ?? `The workflow ${execution.status.toLowerCase()}.`,
          )
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    },
  }), [clientId, appId, navigate, refresh, onRefresh])
}
