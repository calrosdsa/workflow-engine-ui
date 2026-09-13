import { ChevronLeft, ChevronRight, History, X } from 'lucide-react'
import { useExecutions } from '@/features/executions/hooks'
import { formatDuration, computeDurationMs } from '@/features/executions/duration'
import type { Execution, ExecutionStatus } from '@/features/executions/types'
import { Spinner } from '@/components/ui/spinner'
import { useExecutionOverlayStore } from './execution-overlay-store'
import { useBuilderStore } from './store'

export const statusDot: Record<ExecutionStatus, string> = {
  PENDING:   'bg-[hsl(var(--warning))]',
  RUNNING:   'bg-[hsl(var(--primary))]',
  COMPLETED: 'bg-[hsl(var(--success))]',
  FAILED:    'bg-[hsl(var(--destructive))]',
  CANCELLED: 'bg-[hsl(var(--muted-foreground))]',
}

// This sidebar is a compact, fixed-height scrollable list, not a full
// browsing table — no page-navigation UI here by design. pageSize is
// generous (well past what's ever visible without scrolling) rather than
// paginated, matching the panel's pre-pagination "show me everything
// recent" behavior as closely as possible.
const SIDEBAR_PAGE_SIZE = 100

export function ExecutionsSidebar({ workflowId }: { workflowId: string }) {
  const { data, isLoading } = useExecutions({ definitionId: workflowId, pageSize: SIDEBAR_PAGE_SIZE })
  const executions = data?.executions
  const total = data?.total ?? 0
  const selectedExecutionId = useExecutionOverlayStore((s) => s.selectedExecutionId)
  const select = useExecutionOverlayStore((s) => s.select)
  const open = useBuilderStore((s) => s.executionsPanelOpen)
  const toggle = useBuilderStore((s) => s.toggleExecutionsPanel)

  return (
    <aside
      className={[
        'relative flex shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-200',
        open ? 'w-64' : 'w-10',
      ].join(' ')}
    >
      <button
        onClick={toggle}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        title={open ? 'Collapse executions' : 'Expand executions'}
      >
        {open ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
      </button>

      {!open && (
        <div className="flex flex-1 flex-col items-center gap-2 pt-4">
          <History size={15} className="text-[hsl(var(--muted-foreground))]" />
          <span className="rotate-90 select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Executions
          </span>
        </div>
      )}

      {open && (
        <>
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-[hsl(var(--muted-foreground))]" />
              <span className="text-[13px] font-semibold text-[hsl(var(--foreground))]">Executions</span>
              {total > 0 && (
                <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{total}</span>
              )}
            </div>
            {selectedExecutionId && (
              <button
                onClick={() => select(null)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
                title="Clear overlay"
              >
                <X size={11} />Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-8"><Spinner className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></div>
            )}

            {!isLoading && (!executions || executions.length === 0) && (
              <p className="px-3.5 py-6 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
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
        'flex w-full flex-col gap-1 border-b border-[hsl(var(--border))]/50 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]',
        selected ? 'bg-[hsl(var(--primary))]/10' : 'hover:bg-[hsl(var(--muted))]',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <span className={['h-1.5 w-1.5 shrink-0 rounded-full', statusDot[execution.status]].join(' ')} />
        <span className="text-[11px] font-semibold text-[hsl(var(--foreground))]">{execution.status}</span>
        {!isTerminal && <Spinner className="h-3 w-3 text-[hsl(var(--primary))]" />}
        <span className="ml-auto font-mono text-[9px] text-[hsl(var(--muted-foreground))]/70">{execution.execution_id.slice(0, 8)}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
        <span>{new Date(execution.created_at).toLocaleString()}</span>
        {durationMs !== null && <span className="font-medium text-[hsl(var(--muted-foreground))]">{formatDuration(durationMs)}</span>}
      </div>
    </button>
  )
}
