// The export_report custom action's actual dispatch (FR-D2-018 §3/§4) — on
// click, calls the new POST /forms/{form_id}/records/{record_id}/export-report
// endpoint, which SYNCHRONOUSLY generates the report and returns
// {content_id, filename, format, row_count} directly in the response — no
// execution_id, no polling, a deliberate departure from trigger_workflow's
// async dispatch-and-poll shape (see that action's own MenuItem.tsx for the
// contrasting pattern). The backend enforces two independent permission
// gates before generating anything (forms:{id}:view on this route, plus the
// report definition's own Visibility field) — a 403 here means the report
// exists but this viewer isn't in its visibility list, distinct from a 404
// (stale/deleted report reference, filtered out before this even renders,
// same convention as trigger_workflow's stale-reference handling).
//
// On success, mints a presigned download URL (contentApi.presignedUrl) and
// opens it in a new tab — the result IS the file, there's no execution
// detail page to link to the way trigger_workflow's completed-run toast
// implicitly does.
import { useState } from 'react'
import { toast } from 'sonner'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { formsApi } from '@/features/forms/api'
import { contentApi } from '@/features/content/api'
import type { CustomActionMenuItemProps } from '../contract'
import { partitionArguments, type ExportReportActionConfig } from './schema'
import { declaredArguments } from '@/features/reports/arguments'
import { ReportArgumentsDialog } from '@/features/reports/ReportArgumentsDialog'
import { useReports } from '@/features/reports/hooks'

export function ExportReportMenuItem({ formId, recordId, config, label, onDone }: CustomActionMenuItemProps<ExportReportActionConfig>) {
  const [pending, setPending] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const { data: reports } = useReports()

  // No configured report yet — omit rather than dispatch with an empty id,
  // mirroring update_field/trigger_workflow's identical "stale/incomplete
  // config -> omit" convention (FR-D2-017 §6).
  if (!config.reportDefinitionId) return null

  const definition = reports?.find((r) => r.id === config.reportDefinitionId)?.definition
  const argumentList = definition ? declaredArguments(definition) : []
  // Arguments configured as `current_record` are filled from the record in
  // view; only the rest are ever asked about (FR-D2-019 RUN-06/RUN-07).
  const { resolved, toPrompt } = partitionArguments(argumentList, config, formId, recordId)

  const run = async (promptedValues?: Record<string, unknown>) => {
    if (pending) return
    setPending(true)
    const toastId = toast.loading(`Generating "${label}"…`)
    try {
      const argumentValues = { ...resolved, ...(promptedValues ?? {}) }
      const result = await formsApi.exportReport(
        formId,
        recordId,
        config.reportDefinitionId,
        config.format || undefined,
        Object.keys(argumentValues).length > 0 ? argumentValues : undefined,
      )
      setPromptOpen(false)
      onDone?.()

      const { url } = await contentApi.presignedUrl(result.content_id)
      window.open(url, '_blank', 'noopener,noreferrer')

      toast.success(`"${label}" is ready`, {
        id: toastId,
        description: `${result.filename} · ${result.row_count} row${result.row_count === 1 ? '' : 's'}`,
      })
    } catch (e) {
      toast.error(`Couldn't generate "${label}"`, { id: toastId, description: e instanceof Error ? e.message : undefined })
    } finally {
      setPending(false)
    }
  }

  const handleClick = (event: Event | React.MouseEvent) => {
    // Gated on `toPrompt` being non-empty, NOT on needsPrompt(). This action
    // is the one surface where an author has already decided, per argument,
    // whether to ask — partitionArguments encodes that decision, and
    // needsPrompt would override it with its own required-only heuristic.
    // (Found live: an optional argument explicitly set to "Ask the person"
    // was silently never asked about.) Preview and the report list keep using
    // needsPrompt, since neither has any per-argument configuration to honour.
    //
    // Keep the menu open while the dialog is up, otherwise the dropdown
    // closing would unmount this component and the prompt with it.
    if (toPrompt.length > 0) {
      event.preventDefault()
      setPromptOpen(true)
      return
    }
    void run()
  }

  return (
    <>
      <DropdownMenuItem disabled={pending} onSelect={handleClick}>
        {label}
      </DropdownMenuItem>

      <ReportArgumentsDialog
        open={promptOpen}
        argumentList={toPrompt}
        title={label}
        confirmLabel="Export"
        busy={pending}
        onCancel={() => { setPromptOpen(false); onDone?.() }}
        onConfirm={(values) => void run(values)}
      />
    </>
  )
}
