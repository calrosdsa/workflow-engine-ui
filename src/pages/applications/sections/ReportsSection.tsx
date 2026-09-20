import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, ExternalLink, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useReports, useDeleteReport } from '@/features/reports/hooks'
import { declaredArguments } from '@/features/reports/arguments'
import { ReportArgumentsDialog } from '@/features/reports/ReportArgumentsDialog'
import { ReportTemplatePickerDialog } from '@/features/reports/ReportTemplatePickerDialog'
import { runReportToDownload } from '@/features/reports/run-report'
import { usePermission } from '@/features/auth/permissions'
import { extractApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ReportDefinitionRow } from '@/features/reports/types'

interface ReportsSectionProps {
  appId: string
}

// Flat-list analog of WorkflowsPage.tsx, stripped of drag-reorder (a
// report's list position carries no execution-order meaning the way a
// workflow's sort_order does) and trigger/run (a report is generated via
// FR-B2-031's node or FR-D2-018's action, not run directly from this list).
// Closes 3.3 §J's own named gap: before this, a report was reachable only
// by pasting its raw UUID into /applications/$appId/design/reports/$reportId.
export function ReportsSection({ appId }: ReportsSectionProps) {
  const t = useTranslation()
  const { data: reports, isLoading } = useReports()
  const deleteMutation = useDeleteReport()
  const navigate = useNavigate()
  const canWrite = usePermission('application:design')

  const [pickerOpen, setPickerOpen] = useState(false)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const handleCreated = (id: string) => {
    navigate({ to: '/applications/$appId/design/reports/$reportId', params: { appId, reportId: id } })
  }

  const handleDelete = (id: string) => {
    if (!window.confirm(t('reports.section.delete_confirm'))) return
    deleteMutation.mutate(id)
  }

  const rows = reports ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{t('reports.section.title')}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {t(rows.length === 1 ? 'reports.section.count_one' : 'reports.section.count_many', { count: rows.length })}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setPickerOpen(true)}>
            <Plus size={16} />
            {t('reports.section.new_report')}
          </Button>
        )}
      </div>

      {!rows.length ? (
        <EmptyState canWrite={canWrite} onCreate={() => setPickerOpen(true)} />
      ) : (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
          {rows.map((row) => (
            <ReportRow key={row.id} appId={appId} row={row} canWrite={canWrite} onDelete={() => handleDelete(row.id)} />
          ))}
        </div>
      )}

      <ReportTemplatePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}

function ReportRow({ appId, row, canWrite, onDelete }: {
  appId: string
  row: ReportDefinitionRow
  canWrite: boolean
  onDelete: () => void
}) {
  const t = useTranslation()
  const navigate = useNavigate()
  const blockCount = row.definition.blocks.length

  // Running from the list always prompts when the report declares arguments —
  // there is no current record here to infer them from (FR-D2-019 RUN-01).
  const argumentList = declaredArguments(row.definition)
  const [promptOpen, setPromptOpen] = useState(false)
  const [running, setRunning] = useState(false)

  const run = async (argumentValues?: Record<string, unknown>) => {
    if (running) return
    setRunning(true)
    const toastId = toast.loading(t('reports.section.running_toast', { name: row.name }))
    try {
      const { filename, rowCount } = await runReportToDownload(row.definition, argumentValues)
      setPromptOpen(false)
      toast.success(t('reports.section.ready_toast', { name: row.name }), {
        id: toastId,
        description: t(rowCount === 1 ? 'reports.section.download_rows_one' : 'reports.section.download_rows_many', { filename, count: rowCount }),
      })
    } catch (e) {
      toast.error(t('reports.section.run_failed_toast', { name: row.name }), { id: toastId, description: extractApiError(e) })
    } finally {
      setRunning(false)
    }
  }

  const handleRun = () => {
    if (argumentList.length > 0) {
      setPromptOpen(true)
      return
    }
    void run()
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium text-[hsl(var(--foreground))]">{row.name}</span>
        <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
          {t(blockCount === 1 ? 'reports.section.block_count_one' : 'reports.section.block_count_many', { count: blockCount })}
          {' · '}
          {t('reports.section.updated_on', { date: new Date(row.updated_at).toLocaleDateString() })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost" size="icon"
          onClick={handleRun}
          disabled={running}
          title={t('reports.section.run_title')}
          aria-label={t('reports.section.run_aria', { name: row.name })}
        >
          {running ? <Spinner className="h-3.5 w-3.5" /> : <Play size={14} />}
        </Button>
        <Button
          variant="ghost" size="icon"
          onClick={() => navigate({ to: '/applications/$appId/design/reports/$reportId', params: { appId, reportId: row.id } })}
          title={t('reports.section.edit_title')}
          aria-label={t('reports.section.edit_aria', { name: row.name })}
        >
          <ExternalLink size={14} />
        </Button>
        {canWrite && (
          <Button
            size="sm" variant="outline"
            onClick={onDelete}
            className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      <ReportArgumentsDialog
        open={promptOpen}
        argumentList={argumentList}
        title={t('reports.section.run_dialog_title', { name: row.name })}
        busy={running}
        onCancel={() => setPromptOpen(false)}
        onConfirm={(values) => void run(values)}
      />
    </div>
  )
}

function EmptyState({ canWrite, onCreate }: { canWrite: boolean; onCreate: () => void }) {
  const t = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center">
      <p className="text-[hsl(var(--muted-foreground))] mb-4">{t('reports.section.empty_title')}</p>
      {canWrite && (
        <Button variant="outline" onClick={onCreate}>
          <Plus size={16} />
          {t('reports.section.create_first')}
        </Button>
      )}
    </div>
  )
}
