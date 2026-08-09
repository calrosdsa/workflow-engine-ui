import { ChevronLeft, ChevronRight, History, X } from 'lucide-react'
import { useExecutions } from '@/features/executions/hooks'
import { formatDuration, computeDurationMs } from '@/features/executions/duration'
import type { Execution, ExecutionStatus } from '@/features/executions/types'
import { Spinner } from '@/components/ui/spinner'
import { useExecutionOverlayStore } from './execution-overlay-store'
import { useBuilderStore } from './store'

export const statusDot: Record<ExecutionStatus, string> = {
  PENDING:   'bg-amber-400',
  RUNNING:   'bg-blue-500',
  COMPLETED: 'bg-emerald-500',
  FAILED:    'bg-red-500',
  CANCELLED: 'bg-slate-400',
}

export function ExecutionsSidebar({ workflowId }: { workflowId: string }) {
  const { data: executions, isLoading } = useExecutions(workflowId)
  const selectedExecutionId = useExecutionOverlayStore((s) => s.selectedExecutionId)
  const select = useExecutionOverlayStore((s) => s.select)
  const open = useBuilderStore((s) => s.executionsPanelOpen)
  const toggle = useBuilderStore((s) => s.toggleExecutionsPanel)

  return (
    <aside
      className={[
        'relative flex shrink-0 flex-col border-l border-slate-200 bg-white transition-all duration-200',
        open ? 'w-64' : 'w-10',
      ].join(' ')}
    >
      <button
        onClick={toggle}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600"
        title={open ? 'Collapse executions' : 'Expand executions'}
      >
        {open ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {!open && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <History size={15} className="text-slate-400" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Executions
          </span>
        </div>
      )}

      {open && (
        <>
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-slate-400" />
              <span className="text-[13px] font-semibold text-slate-700">Executions</span>
              {executions && executions.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{executions.length}</span>
              )}
            </div>
            {selectedExecutionId && (
              <button
                onClick={() => select(null)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Clear overlay"
              >
                <X size={11} />Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8"><Spinner className="h-4 w-4 text-slate-400" /></div>
            )}

            {!isLoading && (!executions || executions.length === 0) && (
              <p className="px-3.5 py-6 text-center text-[11px] text-slate-400">
                No executions yet. Click "Run" to trigger this workflow.
              </p>
            )}

            {executions?.map((exec) => (
              <ExecutionRow
                key={exec.execution_id}
                execution={exec}
                selected={exec.execution_id === selectedExecutionId}
                onClick={() => select(exec.execution_id)}
              />
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

function ExecutionRow({ execution, selected, onClick }: {
  execution: Execution
  selected: boolean
  onClick: () => void
}) {
  const durationMs = computeDurationMs(execution.started_at, execution.finished_at)
  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(execution.status)

  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full flex-col gap-1 border-b border-slate-50 px-3.5 py-2.5 text-left transition-colors',
        selected ? 'bg-blue-50' : 'hover:bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <span className={['h-1.5 w-1.5 shrink-0 rounded-full', statusDot[execution.status]].join(' ')} />
        <span className="text-[11px] font-semibold text-slate-700">{execution.status}</span>
        {!isTerminal && <Spinner className="h-3 w-3 text-blue-400" />}
        <span className="ml-auto font-mono text-[9px] text-slate-300">{execution.execution_id.slice(0, 8)}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{new Date(execution.created_at).toLocaleString()}</span>
        {durationMs !== null && <span className="font-medium text-slate-500">{formatDuration(durationMs)}</span>}
      </div>
    </button>
  )
}
