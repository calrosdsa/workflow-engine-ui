import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Spinner } from '@/components/ui/spinner'
import { ExecutionLogsPanel, statusSummary } from '@/features/executions/ExecutionLogsPanel'
import { computeDurationMs } from '@/features/executions/duration'
import type { Execution } from '@/features/executions/types'
import { useExecutionOverlayStore } from './execution-overlay-store'
import { statusDot } from './ExecutionsSidebar'

/** Same page size as WorkflowBuilderPage's canvas run-order fetch, so the
 *  dock's first page and that fetch share one cached query — expanding the
 *  dock on an already-selected run costs no extra request. */
export const DOCK_LOGS_PAGE_SIZE = 200

const DEFAULT_HEIGHT = 320
const MIN_HEIGHT = 180
// Of the canvas column's height — the canvas above always keeps a usable
// quarter, however far the dock is dragged (mirrored as a CSS max-height so
// a window shrinking after a drag can't push the canvas to zero either).
const MAX_HEIGHT_RATIO = 0.75
const KEYBOARD_STEP = 24

/**
 * n8n-style Logs panel docked under the Workflow Builder canvas: a thin
 * "Logs" bar while collapsed, a resizable step-list + Input/Output panel
 * while expanded, for whichever run the Executions list has selected.
 *
 * The panel is unmounted (not hidden) while collapsed — a mounted
 * ExecutionLogsPanel is exactly the condition under which it polls, so a
 * collapsed bar costs no requests at all.
 */
export function ExecutionLogsDock({ execution, loading, nodeLabels }: {
  /** The selected run, only once it's confirmed to belong to this workflow. */
  execution: Execution | null
  /** A run is selected but its details haven't resolved yet. */
  loading: boolean
  nodeLabels: Record<string, string>
}) {
  const t = useTranslation()
  const open = useExecutionOverlayStore((s) => s.logsDockOpen)
  const setOpen = useExecutionOverlayStore((s) => s.setLogsDockOpen)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const dockRef = useRef<HTMLElement>(null)
  const bodyId = useId()

  const clampHeight = (next: number) => {
    const column = dockRef.current?.parentElement?.getBoundingClientRect().height
    const max = column ? Math.max(MIN_HEIGHT, column * MAX_HEIGHT_RATIO) : next
    return Math.round(Math.min(Math.max(next, MIN_HEIGHT), max))
  }

  // Same window-level pointer-drag pattern as NodeConfigPanel's pane
  // splitters. The handle sits on the dock's TOP edge, so dragging up
  // (a negative clientY delta) grows the dock.
  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = dockRef.current?.getBoundingClientRect().height ?? height
    const move = (moveEvent: PointerEvent) => setHeight(clampHeight(startHeight - (moveEvent.clientY - startY)))
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    setHeight((current) => clampHeight(current + (event.key === 'ArrowUp' ? KEYBOARD_STEP : -KEYBOARD_STEP)))
  }

  const title = <span className="shrink-0 text-[13px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.executions.logs.title')}</span>
  const runSummary = execution && <RunSummary execution={execution} />

  if (!open) {
    return (
      <section ref={dockRef} aria-label={t('workflows.executions.logs.title')} className="shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="flex h-9 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-[hsl(var(--muted))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]"
          title={t('workflows.executions.logs.expand')}
        >
          {title}
          {runSummary}
          <ChevronUp size={15} className="ml-auto shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          <span className="sr-only">{t('workflows.executions.logs.expand')}</span>
        </button>
      </section>
    )
  }

  const collapseButton = (
    <button
      type="button"
      onClick={() => setOpen(false)}
      aria-expanded
      aria-controls={bodyId}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      title={t('workflows.executions.logs.collapse')}
    >
      <ChevronDown size={15} aria-hidden="true" />
      <span className="sr-only">{t('workflows.executions.logs.collapse')}</span>
    </button>
  )

  return (
    <section
      ref={dockRef}
      aria-label={t('workflows.executions.logs.title')}
      className="relative flex shrink-0 flex-col border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]"
      style={{ height, maxHeight: `${MAX_HEIGHT_RATIO * 100}%` }}
    >
      {/* Straddles the dock's own border-top, so at rest that 1px border is
          the only line; hover/focus draws the same 2px primary rule as
          NodeConfigPanel's pane splitters (.node-workbench-splitter). */}
      <button
        type="button"
        aria-label={t('workflows.executions.logs.resize')}
        onPointerDown={beginResize}
        onKeyDown={resizeWithKeyboard}
        className="absolute inset-x-0 top-0 z-[5] m-0 h-2 -translate-y-1/2 cursor-row-resize touch-none border-0 bg-transparent p-0 focus-visible:outline-none after:absolute after:inset-x-0 after:top-1/2 after:h-0.5 after:-translate-y-1/2 after:bg-[hsl(var(--primary))] after:opacity-0 after:content-[''] hover:after:opacity-100 focus-visible:after:opacity-100"
      />
      <div id={bodyId} className="flex min-h-0 flex-1 flex-col">
        {execution ? (
          <ExecutionLogsPanel
            // Remount per run: page/selection/view state belongs to one run,
            // and a stale page index would otherwise carry over to the next.
            key={execution.execution_id}
            variant="docked"
            executionId={execution.execution_id}
            executionStatus={execution.status}
            executionFinishedAt={execution.finished_at}
            nodeLabels={nodeLabels}
            pageSize={DOCK_LOGS_PAGE_SIZE}
            listHeader={<>{title}{runSummary}</>}
            detailActions={collapseButton}
          />
        ) : (
          <>
            <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] px-3">
              {title}
              <div className="ml-auto">{collapseButton}</div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {loading ? <Spinner className="h-4 w-4" /> : t('workflows.executions.logs.no_execution_selected')}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function RunSummary({ execution }: { execution: Execution }) {
  const t = useTranslation()
  const inFlight = execution.status === 'RUNNING' || execution.status === 'PENDING'
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot[execution.status])} aria-hidden="true" />
      <span className="truncate">{statusSummary(t, execution.status, computeDurationMs(execution.started_at, execution.finished_at))}</span>
      {inFlight && <Spinner className="h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />}
    </span>
  )
}
