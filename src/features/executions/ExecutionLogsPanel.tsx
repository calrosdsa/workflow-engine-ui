// The Logs panel (FR-C5-007): a left-rail list of every step an execution
// actually ran (including the trigger), with an Input/Output switch showing
// the real JSON/tabular data that flowed through whichever step is selected.
//
// Deliberately usable from more than one host — ExecutionDetailPage (the
// bordered 'card' variant) and the Workflow Builder's bottom Logs dock (the
// edge-to-edge 'docked' variant). It owns no page chrome of its own (no
// <h1>, no back link); a host that wants a title or a collapse control slots
// them in via `listHeader` / `detailActions` so the panel still reads as one
// n8n-style surface rather than a host header stacked on a second header.
import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, MinusCircle, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { iconFor } from '@/features/workflows/builder/icon-hints'
import { defaultLabel } from '@/features/workflows/builder/node-registry'
import { useLeverOf } from '@/features/workflows/builder/lever'
import { detectPayloadShape } from './payload-shape'
import { useExecutionLogs } from './hooks'
import { formatDuration } from './duration'
import type { ExecutionLogStatus, ExecutionNodeLog, ExecutionStatus } from './types'

const DEFAULT_LOG_PAGE_SIZE = 50

type LogView = 'input' | 'output'
/** How a table-shaped payload is shown. JSON is the escape hatch that
 *  guarantees nothing is hidden — a table shows only the unwrapped records
 *  (e.g. an HTTP body), never the wrapper's status_code/headers. */
type PayloadDisplay = 'table' | 'json'
type Translate = ReturnType<typeof useTranslation>

interface ExecutionLogsPanelProps {
  executionId: string
  /** Drives the step list's own poll cadence (useExecutionLogs polls every
   *  4s while non-terminal, not at all once terminal) — pass the parent
   *  execution's status, not this panel's own guess. */
  executionStatus?: ExecutionStatus
  /** The run's finished_at — lets the step list keep polling for a few
   *  seconds after a run turns terminal, until its last rows have landed. */
  executionFinishedAt?: string | null
  /** 'card' (default) is a bordered block with a minimum height, for a page
   *  body. 'docked' fills its host edge to edge (h-full, no border/radius)
   *  so a resizable host decides the height, not this panel. */
  variant?: 'card' | 'docked'
  /** Canvas labels by node_id, so a step reads as the name the user gave its
   *  node. Falls back to the node type's registry label ("HTTP Request"). */
  nodeLabels?: Record<string, string>
  /** Rendered at the top of the step-list column (the dock's "Logs" title +
   *  run summary). */
  listHeader?: ReactNode
  /** Keep the right end of the detail header clear for a control the host
   *  overlays there (the dock's collapse toggle, which lives outside this
   *  panel so it stays the same element — and keeps focus — across
   *  expand/collapse). */
  reserveHeaderEnd?: boolean
  /** Rows per page. The builder dock passes the same page size as the
   *  canvas's run-order fetch (WorkflowBuilderPage) so both share one cached
   *  query instead of firing a second request for the same rows. */
  pageSize?: number
}

export function ExecutionLogsPanel({
  executionId, executionStatus, executionFinishedAt, variant = 'card', nodeLabels, listHeader, reserveHeaderEnd = false, pageSize = DEFAULT_LOG_PAGE_SIZE,
}: ExecutionLogsPanelProps) {
  const t = useTranslation()
  const [page, setPage] = useState(1)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  // Held here, not inside LogDetail, so switching steps keeps whichever view
  // the user picked. Output first: what a step produced is the usual
  // question, and it's what n8n's own logs view opens on.
  const [view, setView] = useState<LogView>('output')
  const [display, setDisplay] = useState<PayloadDisplay>('table')

  // enabled: true — a mounted ExecutionLogsPanel IS the "Logs panel actually
  // open" condition useExecutionLogs's own doc comment names as the only
  // reason (besides the canvas overlay) this second poll is allowed to fire.
  // The builder dock keeps that invariant by unmounting this panel while
  // collapsed rather than threading an `enabled` flag through.
  const { data, isLoading, isError } = useExecutionLogs(
    executionId,
    { page, pageSize },
    { enabled: true, executionStatus, finishedAt: executionFinishedAt },
  )
  const logs = data?.logs ?? []
  // The last total any page reported. `data` is undefined while a newly
  // requested page loads (and stays so if that fetch fails), so deriving the
  // page count from it alone would briefly unmount the pager mid-click —
  // taking keyboard focus with it — or leave no way back from a failed page.
  const [knownTotal, setKnownTotal] = useState(0)
  useEffect(() => {
    if (data) setKnownTotal(data.total)
  }, [data])
  const total = data?.total ?? knownTotal
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Keep the current selection across a poll refresh when it's still on this
  // page; otherwise (first load, or a page change) default to the first row
  // — the trigger row when page 1, since the backend always orders
  // chronologically with the trigger first.
  //
  // Depends on `data`, not the derived `logs` array: `data?.logs ?? []`
  // creates a brand-new [] on every render while data is undefined (initial
  // load, or the gap between a page change and its fetch landing), which
  // would re-run this effect on every unrelated re-render too. `data` itself
  // is the stable reference react-query hands back until a fetch actually
  // resolves, so this only re-runs when there's real new data to react to.
  useEffect(() => {
    const currentLogs = data?.logs ?? []
    setSelectedLogId((prev) => {
      if (prev && currentLogs.some((log) => log.id === prev)) return prev
      return currentLogs[0]?.id ?? null
    })
  }, [data])

  const selected = logs.find((log) => log.id === selectedLogId) ?? null

  return (
    <div
      className={cn(
        // The step list takes ~38% of the width, at most 18rem and at least
        // 9rem — or 40% when even 9rem would starve the detail column — so
        // in a narrow canvas column (side panels open) it gives way before
        // the detail header's Input/Output switch (~8rem with padding) does.
        'grid grid-cols-[minmax(min(9rem,40%),min(18rem,38%))_minmax(0,1fr)] overflow-hidden bg-[hsl(var(--card))]',
        variant === 'docked' ? 'h-full min-h-0' : 'min-h-[24rem] rounded-lg border border-[hsl(var(--border))]',
      )}
    >
      <aside className="flex min-h-0 flex-col border-r border-[hsl(var(--border))]">
        {listHeader && (
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] px-3">{listHeader}</div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            </div>
          )}
          {!isLoading && logs.length === 0 && (
            <p className="px-3.5 py-6 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              {t(isError ? 'workflows.executions.logs.load_error' : 'workflows.executions.logs.empty')}
            </p>
          )}
          {logs.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              label={stepLabel(log, nodeLabels, t)}
              selected={log.id === selectedLogId}
              onClick={() => setSelectedLogId(log.id)}
            />
          ))}
        </div>
        {(totalPages > 1 || page > 1) && (
          <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] px-2.5 py-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>{t('workflows.executions.logs.page_of', { page, totalPages })}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-6 gap-1 px-1.5 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={11} />{t('workflows.executions.logs.prev')}
              </Button>
              <Button variant="outline" size="sm" className="h-6 gap-1 px-1.5 text-[10px]" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {t('workflows.executions.logs.next')}<ChevronRight size={11} />
              </Button>
            </div>
          </div>
        )}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        {selected ? (
          <LogDetail
            log={selected}
            label={stepLabel(selected, nodeLabels, t)}
            view={view}
            onViewChange={setView}
            display={display}
            onDisplayChange={setDisplay}
            reserveHeaderEnd={reserveHeaderEnd}
          />
        ) : (
          <>
            {reserveHeaderEnd && <div className="h-10 shrink-0 border-b border-[hsl(var(--border))]" />}
            <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">{t('workflows.executions.logs.select_step_hint')}</p>
          </>
        )}
      </section>
    </div>
  )
}

/**
 * "Success in 37ms" / "Error in 1.2s" — the n8n-style one-line outcome shown
 * for both a whole run (the dock's header) and a single step (the detail
 * header). Falls back to the plain status word while there's no duration
 * yet (a queued or still-running run/step).
 */
export function statusSummary(t: Translate, status: ExecutionStatus | ExecutionLogStatus, durationMs: number | null): string {
  if (durationMs !== null && (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED')) {
    return t(`workflows.executions.logs.summary.${status}`, { duration: formatDuration(durationMs) })
  }
  return t(`workflows.executions.logs.status.${status}`)
}

function stepLabel(log: ExecutionNodeLog, nodeLabels: Record<string, string> | undefined, t: Translate): string {
  const canvasLabel = nodeLabels?.[log.node_id]
  // A loop chunk's node_id is its Iterator's, so two iterators' chunks stay
  // distinguishable by that iterator's canvas name ("For each invoice — …").
  // `||`, not `??`: a node whose name was cleared in the builder has label ''.
  if (log.kind === 'loop_chunk') return loopChunkLabel(log, canvasLabel || t('workflows.executions.logs.loop_body_label'), t)
  if (canvasLabel) return canvasLabel
  return log.kind === 'trigger' ? t('workflows.executions.logs.trigger_label') : defaultLabel(log.node_type)
}

// The engine logs a trigger's payload (its variables and trigger record) as
// the row's INPUT (trigger_log.go), but what a trigger produces — the data
// its first step receives — is its output, and that's where n8n shows it.
// Older/other rows that do carry an output are shown as-is.
function stepPayloads(log: ExecutionNodeLog): { input: unknown; output: unknown } {
  if (log.kind === 'trigger' && log.output == null && log.input != null) return { input: null, output: log.input }
  return { input: log.input, output: log.output }
}

// Same icon (and accent colour) the canvas node itself shows — a step in this
// list and its node on the canvas should read as the same thing at a glance.
// loop_chunk has no node type of its own (it's a synthesized
// chunk-of-the-iterator summary row, not a distinct graph node), so it keeps
// its own Repeat icon in the iterator's accent.
function stepIcon(log: ExecutionNodeLog, leverOf: (type: string) => string) {
  if (log.kind === 'loop_chunk') return { Icon: Repeat, lever: leverOf('iterator') }
  return { Icon: iconFor(log.node_type), lever: leverOf(log.node_type) }
}

function StepStatusIcon({ status }: { status: ExecutionLogStatus }) {
  const t = useTranslation()
  const Icon = status === 'COMPLETED' ? CheckCircle2 : status === 'FAILED' ? AlertCircle : MinusCircle
  const color = status === 'COMPLETED'
    ? 'text-[hsl(var(--success))]'
    : status === 'FAILED' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'
  return (
    <>
      {status === 'RUNNING'
        ? <Spinner className="h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />
        : <Icon size={13} className={cn('shrink-0', color)} aria-hidden="true" />}
      <span className="sr-only">{t(`workflows.executions.logs.status.${status}`)}</span>
    </>
  )
}

function LogRow({ log, label, selected, onClick }: { log: ExecutionNodeLog; label: string; selected: boolean; onClick: () => void }) {
  const { Icon, lever } = stepIcon(log, useLeverOf())
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex h-8 w-full items-center gap-2 px-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]',
        selected ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/60',
      )}
    >
      <Icon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" data-lever={lever} style={{ color: 'hsl(var(--lever))' }} />
      <span className="min-w-0 flex-1 truncate font-medium" title={label}>{label}</span>
      {log.duration_ms !== null && (
        <span className="shrink-0 tabular-nums text-[11px] text-[hsl(var(--muted-foreground))]">{formatDuration(log.duration_ms)}</span>
      )}
      <StepStatusIcon status={log.status} />
    </button>
  )
}

// chunk_index is confirmed (per the backend implementation) to be the
// chunk's own source-item offset within the iterator's full list — e.g. 0,
// 500, 1000 for 500-item chunks — NOT an ordinal chunk number, and
// chunk_count is a separate, independently-scaled count of planned chunks
// for the run. The two are different units and cannot be combined as
// "chunk {chunk_index} of {chunk_count}" (that would render nonsense like
// "chunk 1000 of 8"). Displaying the item range instead avoids needing the
// backend's chunk-size constant at all, and stays correct across
// Continue-As-New hops the same way chunk_index itself does.
function loopChunkLabel(log: ExecutionNodeLog, label: string, t: Translate): string {
  const hasRange = log.chunk_index != null && log.item_count != null
  const vars = {
    label,
    startItem: hasRange ? log.chunk_index! + 1 : '—',
    endItem: hasRange ? log.chunk_index! + log.item_count! : '—',
    items: log.item_count ?? '—',
  }
  return log.failed_item_count
    ? t('workflows.executions.logs.loop_chunk_summary_failed', { ...vars, failed: log.failed_item_count })
    : t('workflows.executions.logs.loop_chunk_summary', vars)
}

// Segmented Input/Output switch — the shared Tabs are an underline strip by
// default; these overrides turn the same accessible Radix tabs into the
// compact pill toggle n8n's logs header uses.
const SEGMENT_LIST = 'h-7 gap-0.5 rounded-md border bg-[hsl(var(--muted))] p-0.5'
const SEGMENT_TRIGGER = 'mb-0 h-6 rounded border-0 px-2.5 py-0 text-xs data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:shadow-sm'

function LogDetail({ log, label, view, onViewChange, display, onDisplayChange, reserveHeaderEnd }: {
  log: ExecutionNodeLog
  label: string
  view: LogView
  onViewChange: (view: LogView) => void
  display: PayloadDisplay
  onDisplayChange: (display: PayloadDisplay) => void
  reserveHeaderEnd: boolean
}) {
  const t = useTranslation()
  const { Icon, lever } = stepIcon(log, useLeverOf())
  const { input, output } = stepPayloads(log)

  return (
    <Tabs value={view} onValueChange={(next) => onViewChange(next as LogView)} className="flex min-h-0 flex-1 flex-col">
      {/* Wraps instead of clipping: in a narrow column the Input/Output
          switch drops to a second line rather than being cut off. The step
          name keeps a floor; the outcome text shrinks first. */}
      <header className={cn(
        'flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[hsl(var(--border))] py-1.5 pl-3',
        reserveHeaderEnd ? 'pr-12' : 'pr-3',
      )}>
        <Icon size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" data-lever={lever} style={{ color: 'hsl(var(--lever))' }} />
        <h3 className="min-w-[3rem] truncate text-[13px] font-semibold text-[hsl(var(--foreground))]" title={log.node_id}>{label}</h3>
        <span className="min-w-0 truncate text-xs text-[hsl(var(--muted-foreground))]">{statusSummary(t, log.status, log.duration_ms)}</span>
        {log.attempt > 1 && (
          <span className="shrink-0 whitespace-nowrap text-xs text-[hsl(var(--muted-foreground))]">{t('workflows.executions.logs.attempt_label', { attempt: log.attempt })}</span>
        )}
        <TabsList className={cn(SEGMENT_LIST, 'ml-auto shrink-0')}>
          <TabsTrigger value="input" className={SEGMENT_TRIGGER}>{t('workflows.executions.logs.input_tab')}</TabsTrigger>
          <TabsTrigger value="output" className={SEGMENT_TRIGGER}>{t('workflows.executions.logs.output_tab')}</TabsTrigger>
        </TabsList>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {log.error_message && (
          <div className="rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-3 py-2">
            <p className="text-xs font-semibold text-[hsl(var(--destructive))]">{t('workflows.executions.logs.error_label')}</p>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-[hsl(var(--destructive))]">{log.error_message}</pre>
          </div>
        )}
        <TabsContent value="input" className="mt-0">
          <PayloadView
            log={log}
            payload={input}
            sectionLabel={t('workflows.executions.logs.input_tab')}
            display={display}
            onDisplayChange={onDisplayChange}
            emptyMessage={log.kind === 'trigger' ? t('workflows.executions.logs.trigger_no_input') : undefined}
          />
        </TabsContent>
        <TabsContent value="output" className="mt-0">
          <PayloadView log={log} payload={output} sectionLabel={t('workflows.executions.logs.output_tab')} display={display} onDisplayChange={onDisplayChange} />
        </TabsContent>
      </div>
    </Tabs>
  )
}

const DISPLAY_BUTTON = 'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]'

// A loop chunk's logged input is a bounded SAMPLE of its items, not the
// items themselves (loop_chunk.go sampleChunkItems): `items` for a small
// chunk, else `first_items` + `last_items`, alongside the chunk's real
// `item_count`. The sampled rows are what the table shows; JSON still shows
// the whole logged object, note and all.
function loopSample(log: ExecutionNodeLog, payload: unknown): { rows: unknown[]; total: number; ends: { first: number; last: number } | null } | null {
  if (log.kind !== 'loop_chunk' || typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const p = payload as Record<string, unknown>
  const first = Array.isArray(p.first_items) ? p.first_items : null
  const last = Array.isArray(p.last_items) ? p.last_items : null
  const rows = Array.isArray(p.items) ? p.items : first || last ? [...(first ?? []), ...(last ?? [])] : null
  if (!rows) return null
  const total = typeof p.item_count === 'number' ? p.item_count : log.item_count ?? rows.length
  // First/last samples sit back to back in the table, so the notice has to
  // say which items they are — rows 4–6 are really the chunk's LAST items.
  const ends = Array.isArray(p.items) ? null : { first: first?.length ?? 0, last: last?.length ?? 0 }
  return { rows, total, ends }
}

function PayloadView({ log, payload, sectionLabel, display, onDisplayChange, emptyMessage }: {
  log: ExecutionNodeLog
  payload: unknown
  sectionLabel: string
  display: PayloadDisplay
  onDisplayChange: (display: PayloadDisplay) => void
  /** Replaces the generic "no data captured" text (e.g. a trigger has no input). */
  emptyMessage?: string
}) {
  const t = useTranslation()
  const empty = log.dropped_payload || payload === null || payload === undefined
  const sample = empty ? null : loopSample(log, payload)
  const shape = empty ? null : detectPayloadShape(sample ? sample.rows : payload)
  const showTable = shape?.kind === 'table' && display === 'table'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        <span>{sectionLabel}</span>
        {shape?.kind === 'table' && (
          <div className="flex items-center gap-2">
            <span>
              {shape.rows.length === 1
                ? t('workflows.executions.logs.item_count_one', { count: 1 })
                : t('workflows.executions.logs.item_count', { count: shape.rows.length })}
            </span>
            <div role="group" aria-label={t('workflows.executions.logs.display_mode')} className="inline-flex gap-0.5 rounded-md border border-[hsl(var(--border))] p-0.5 normal-case tracking-normal">
              {(['table', 'json'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={display === mode}
                  onClick={() => onDisplayChange(mode)}
                  className={cn(
                    DISPLAY_BUTTON,
                    display === mode
                      ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                  )}
                >
                  {t(`workflows.executions.logs.display_${mode}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {log.dropped_payload ? (
        <p className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">
          {t('workflows.executions.logs.dropped_payload')}
        </p>
      ) : !shape ? (
        <p className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">
          {emptyMessage ?? t('workflows.executions.logs.no_data')}
        </p>
      ) : (
        <>
          {sample && sample.rows.length < sample.total && (
            <p className="text-[11px] italic text-[hsl(var(--muted-foreground))]">
              {sample.ends
                ? t('workflows.executions.logs.sample_notice_ends', { first: sample.ends.first, last: sample.ends.last, total: sample.total })
                : t('workflows.executions.logs.sample_notice', { shown: sample.rows.length, total: sample.total })}
            </p>
          )}
          {showTable && shape.kind === 'table' ? (
            <DataTable
              columns={shape.columns.map((key): DataTableColumn => ({
                key,
                label: key,
                // Default formatCell JSON.stringify's an object onto one
                // unreadable line (`{"city":"...","geo":{"lat":"...", ...`) —
                // NestedFieldValue instead renders it the way this data
                // actually reads: one "key : value" pair per line, indented
                // one level deeper for each nested object (address.geo.lat).
                render: (row) => <NestedFieldValue value={row[key]} />,
              }))}
              // Prefixed with this log's own id, not just the row index:
              // LogDetail isn't remounted when the selected step changes (so
              // switching steps keeps the chosen Input/Output view), so two
              // different steps' same-length tables would otherwise collide
              // on plain "0", "1", … keys and React would reconcile stale
              // rows from the previous step's table into the new one.
              rows={shape.rows.map((row, i) => ({ ...row, __rowId: `${log.id}-${i}` }))}
              getRowId={(row) => String(row.__rowId)}
            />
          ) : (
            <pre className="max-h-96 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs">
              {JSON.stringify(payload, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

// How many levels of nested plain objects NestedFieldValue will indent
// through (address.geo.lat is 2 levels) before giving up and falling back to
// one JSON.stringify'd line — bounded the same way payload-shape.ts's own
// MAX_UNWRAP_DEPTH is, so an unusually deep or cyclic-looking structure can't
// render an unbounded recursive tree.
const MAX_NESTED_VALUE_DEPTH = 4

// Renders one table cell's value the way a human reads a record, not the way
// JSON.stringify prints one: a plain object becomes a "key : value" line per
// field (nesting further objects one indent level deeper), matching how
// reference tools in this space (e.g. n8n's own execution log table) render
// an address/company-shaped field instead of collapsing it to unreadable
// inline JSON. Arrays are left to the existing JSON.stringify fallback —
// they're rare in this specific position (a field's value, not the payload's
// own top level, which detectPayloadShape already handles) and don't have
// the same obvious "one line per key" reading as an object does.
function NestedFieldValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-[hsl(var(--muted-foreground))]">—</span>
  // The literal value, as the JSON view and n8n show it — not a relabelled
  // (and untranslated) Yes/No.
  if (typeof value === 'boolean') return <>{String(value)}</>
  if (typeof value !== 'object' || Array.isArray(value) || depth >= MAX_NESTED_VALUE_DEPTH) {
    return typeof value === 'object' ? <>{JSON.stringify(value)}</> : <>{String(value)}</>
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return <span className="text-[hsl(var(--muted-foreground))]">—</span>
  return (
    <div className="space-y-0.5">
      {entries.map(([key, v]) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-1 text-xs leading-relaxed">
          <span className="font-semibold text-[hsl(var(--foreground))]">{key}</span>
          <span className="text-[hsl(var(--muted-foreground))]">:</span>
          {typeof v === 'object' && v !== null && !Array.isArray(v) ? (
            <div className="mt-0.5 basis-full pl-3"><NestedFieldValue value={v} depth={depth + 1} /></div>
          ) : (
            <span className="min-w-0 text-[hsl(var(--muted-foreground))]"><NestedFieldValue value={v} depth={depth + 1} /></span>
          )}
        </div>
      ))}
    </div>
  )
}
