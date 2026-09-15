import { useState } from 'react'
import { Check, Clock3, Copy, History, Pause, Play, RefreshCw, X } from 'lucide-react'
import { useExecutions } from '@/features/executions/hooks'
import { formatDuration, computeDurationMs } from '@/features/executions/duration'
import type { Execution, ExecutionStatus } from '@/features/executions/types'
import { Spinner } from '@/components/ui/spinner'
import { useExecutionOverlayStore } from './execution-overlay-store'
import { useBuilderStore } from './store'
import { cn } from '@/lib/utils'
import { useI18n } from '@/features/i18n/I18nProvider'

export const statusDot: Record<ExecutionStatus, string> = {
  PENDING: 'bg-[hsl(var(--warning))]', RUNNING: 'bg-[hsl(var(--primary))]',
  COMPLETED: 'bg-[hsl(var(--success))]', FAILED: 'bg-[hsl(var(--destructive))]',
  CANCELLED: 'bg-[hsl(var(--muted-foreground))]',
}

const SIDEBAR_PAGE_SIZE = 100
const FILTERS: Array<{ value: ExecutionStatus | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'common.all' }, { value: 'FAILED', labelKey: 'common.failed' },
  { value: 'RUNNING', labelKey: 'common.running' }, { value: 'PENDING', labelKey: 'common.pending' },
  { value: 'COMPLETED', labelKey: 'common.completed' }, { value: 'CANCELLED', labelKey: 'common.cancelled' },
]

/**
 * The inspector is a view-only companion to the canvas. Selecting a run
 * overlays its actual node states (and feeds the bottom Logs dock, n8n-style:
 * executions list on the left, per-step logs under the canvas); copying a
 * run only pins its context for the editor's Input tab and never writes into
 * the workflow definition.
 */
export function ExecutionsSidebar({ workflowId }: { workflowId: string }) {
  const { t } = useI18n()
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { data, isLoading, isFetching, refetch } = useExecutions(
    { definitionId: workflowId, ...(statusFilter === 'all' ? {} : { status: statusFilter }), pageSize: SIDEBAR_PAGE_SIZE },
    { refetchInterval: autoRefresh ? 5000 : false },
  )
  const executions = data?.executions ?? []
  const total = data?.total ?? 0
  const selectedExecutionId = useExecutionOverlayStore((s) => s.selectedExecutionId)
  const overlayData = useExecutionOverlayStore((s) => s.data)
  const copiedExecution = useExecutionOverlayStore((s) => s.copiedExecution)
  const select = useExecutionOverlayStore((s) => s.select)
  const copyToEditor = useExecutionOverlayStore((s) => s.copyToEditor)
  const clearCopiedExecution = useExecutionOverlayStore((s) => s.clearCopiedExecution)
  const open = useBuilderStore((s) => s.executionsPanelOpen)
  const toggle = useBuilderStore((s) => s.toggleExecutionsPanel)
  const selectedRow = executions.find((execution) => execution.execution_id === selectedExecutionId)
  const inspectedExecution = overlayData?.execution_id === selectedExecutionId ? overlayData : selectedRow

  // Surfaced only through the header's "Executions" tab (WorkflowBuilderPage)
  // — no left-edge collapsed rail of its own, so there is never a thin
  // always-there strip cluttering the canvas edge while it's closed.
  if (!open) return null

  return (
    <aside className="relative flex w-[22rem] shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]" aria-label={t('workflows.execution_inspector.title')}>
      <header className="border-b border-[hsl(var(--border))] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2"><History size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><span className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.execution_inspector.title')}</span>{total > 0 && <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{total}</span>}</div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => void refetch()} className="flex h-6 w-6 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]" title={t('workflows.execution_inspector.refresh')}><RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /></button>
            <button type="button" onClick={toggle} className="flex h-6 w-6 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]" title={t('workflows.execution_inspector.close')}><X size={13} /></button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="sr-only" htmlFor="execution-status-filter">{t('workflows.execution_inspector.filter')}</label>
          <select id="execution-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ExecutionStatus | 'all')} className="h-7 min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-[11px] text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
            {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{t(filter.labelKey)}</option>)}
          </select>
          <button type="button" onClick={() => setAutoRefresh((enabled) => !enabled)} aria-pressed={autoRefresh} className={cn('flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]', autoRefresh ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]')} title={autoRefresh ? t('workflows.execution_inspector.live_on') : t('workflows.execution_inspector.live_off')}>
            {autoRefresh ? <Play size={10} fill="currentColor" /> : <Pause size={10} />}{t('workflows.execution_inspector.live')}
          </button>
        </div>
        {copiedExecution && <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-[hsl(var(--primary))]/10 px-2 py-1.5 text-[10px] text-[hsl(var(--primary))]"><span className="min-w-0 truncate">{t('workflows.execution_inspector.pinned', { id: copiedExecution.execution_id.slice(0, 8) })}</span><button type="button" onClick={clearCopiedExecution} className="shrink-0 rounded p-0.5 hover:bg-[hsl(var(--primary))]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]" title={t('workflows.execution_inspector.remove_pinned')}><X size={11} /></button></div>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center py-8"><Spinner className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></div>}
        {!isLoading && executions.length === 0 && <p className="px-3.5 py-6 text-center text-[11px] text-[hsl(var(--muted-foreground))]">{t('workflows.execution_inspector.no_matches')}</p>}
        {executions.map((execution) => <ExecutionRow key={execution.execution_id} execution={execution} selected={execution.execution_id === selectedExecutionId} onClick={() => select(execution.execution_id)} />)}
      </div>
      {selectedExecutionId && <ExecutionDetails execution={inspectedExecution} onClear={() => select(null)} onCopy={() => inspectedExecution && copyToEditor(inspectedExecution)} copied={copiedExecution?.execution_id === selectedExecutionId} />}
    </aside>
  )
}

function ExecutionRow({ execution, selected, onClick }: { execution: Execution; selected: boolean; onClick: () => void }) {
  const { t } = useI18n()
  const durationMs = computeDurationMs(execution.started_at, execution.finished_at)
  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(execution.status)
  return <button type="button" onClick={onClick} className={cn('flex w-full flex-col gap-1 border-b border-[hsl(var(--border))]/50 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]', selected ? 'bg-[hsl(var(--primary))]/10' : 'hover:bg-[hsl(var(--muted))]')}>
    <div className="flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot[execution.status])} /><span className="text-[11px] font-semibold text-[hsl(var(--foreground))]">{executionStatusLabel(execution.status, t)}</span>{!isTerminal && <Spinner className="h-3 w-3 text-[hsl(var(--primary))]" />}<span className="ml-auto font-mono text-[9px] text-[hsl(var(--muted-foreground))]/70">{execution.execution_id.slice(0, 8)}</span></div>
    <div className="flex items-center justify-between gap-2 text-[10px] text-[hsl(var(--muted-foreground))]"><span className="truncate">{new Date(execution.created_at).toLocaleString()}</span>{durationMs !== null && <span className="shrink-0 font-medium">{formatDuration(durationMs)}</span>}</div>
  </button>
}

function ExecutionDetails({ execution, onClear, onCopy, copied }: { execution: Execution | undefined; onClear: () => void; onCopy: () => void; copied: boolean }) {
  const { t } = useI18n()
  if (!execution) return <div className="border-t border-[hsl(var(--border))] px-3.5 py-3 text-[11px] text-[hsl(var(--muted-foreground))]">{t('workflows.execution_inspector.loading_details')}</div>
  const durationMs = computeDurationMs(execution.started_at, execution.finished_at)
  const failure = execution.error_message ?? Object.values(execution.node_errors ?? {})[0]
  return <section className="max-h-[42%] shrink-0 overflow-y-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/55 px-3.5 py-3" aria-label={t('workflows.execution_inspector.details')}>
    <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot[execution.status])} /><span className="truncate text-[11px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.execution_inspector.selected')}</span><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{execution.execution_id.slice(0, 8)}</span></div><button type="button" onClick={onClear} className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" title={t('workflows.execution_inspector.clear_overlay')}><X size={13} /></button></div>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]"><span className="inline-flex items-center gap-1"><Clock3 size={10} />{durationMs === null ? t('workflows.execution_inspector.duration_pending') : formatDuration(durationMs)}</span><span>{new Date(execution.created_at).toLocaleString()}</span></div>
    {failure && <div className="mt-2 rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-2 py-1.5 text-[10px] leading-relaxed text-[hsl(var(--destructive))]">{failure}</div>}
    {execution.final_variables && Object.keys(execution.final_variables).length > 0 && <details className="mt-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><summary className="cursor-pointer px-2 py-1.5 text-[10px] font-medium text-[hsl(var(--foreground))]">{t('workflows.execution_inspector.final_context', { count: Object.keys(execution.final_variables).length })}</summary><pre className="max-h-28 overflow-auto border-t border-[hsl(var(--border))] p-2 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">{JSON.stringify(execution.final_variables, null, 2)}</pre></details>}
    <button type="button" onClick={onCopy} className={cn('mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]', copied ? 'border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : 'border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]')} title={t('workflows.execution_inspector.pin_context')}>
      {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? t('workflows.execution_inspector.context_in_editor') : t('workflows.execution_inspector.copy_context')}
    </button>
  </section>
}

function executionStatusLabel(status: ExecutionStatus, t: (key: string, vars?: Record<string, string | number>) => string) {
  const keys: Record<ExecutionStatus, string> = {
    PENDING: 'common.pending', RUNNING: 'common.running', COMPLETED: 'common.completed',
    FAILED: 'common.failed', CANCELLED: 'common.cancelled',
  }
  return t(keys[status])
}
