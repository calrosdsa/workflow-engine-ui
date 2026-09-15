import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { executionsApi, type GetExecutionLogsParams, type ListExecutionsParams } from './api'
import type { ExecutionStatus } from './types'

export const executionKeys = {
  all:      (params: ListExecutionsParams = {}) => ['executions', params] as const,
  detail:   (id: string)     => ['executions', id] as const,
  // Nested under 'executions' (not a separate top-level key) so
  // useTriggerExecution's existing invalidateQueries({queryKey: ['executions']})
  // also invalidates any open Logs panel/ordering fetch for that execution.
  logs:     (id: string, params: GetExecutionLogsParams = {}) => ['executions', id, 'logs', params] as const,
}

const TERMINAL: ExecutionStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

// Log rows reach Postgres through the worker's batched nodelog.Writer (flushed
// every ≤200ms), so a run can already read as terminal a beat before its
// final step's row lands. A terminal run's rows are treated as final
// (immutable, never refetched) only once BOTH hold:
//   1. a fetch landed after the run was first seen terminal — rows cached
//      while it was still running may predate its last steps, however long
//      ago it actually finished; and
//   2. for a run that finished recently, LOG_SETTLE_MS have passed since
//      that first sighting (1s polling meanwhile), so a just-flushed last
//      row still makes it in.
//
// Both are timed on the browser's clock, from the first sighting — never
// from the server's finished_at, whose clock (Postgres in a Docker/WSL2 VM
// in dev) was seen drifting ~10s from the browser's. finished_at only
// decides whether a run is recent enough to need the settle window, with a
// tolerance wide enough to absorb that drift.
const LOG_SETTLE_MS = 5000
const RECENT_FINISH_MS = 60_000
// Upper bound on post-terminal 1s polling, so an endpoint that keeps failing
// can't be retried forever.
const MAX_CATCH_UP_MS = 30_000

function finishedRecently(finishedAt?: string | null): boolean {
  if (!finishedAt) return false
  const finished = Date.parse(finishedAt)
  return !Number.isNaN(finished) && Math.abs(Date.now() - finished) < RECENT_FINISH_MS
}

// First sighting of each execution as terminal, shared by every caller and
// kept across remounts: the builder's Logs dock unmounts its panel while
// collapsed, and the canvas's run-order caller follows the selection — a
// per-component record would restart the settle window (and refetch) on
// every re-expand or A→B→A reselection. Bounded; oldest entries go first.
const terminalSeenAt = new Map<string, number>()
const MAX_TRACKED_RUNS = 500

function firstSeenTerminal(executionId: string): number {
  const known = terminalSeenAt.get(executionId)
  if (known !== undefined) return known
  const now = Date.now()
  terminalSeenAt.set(executionId, now)
  if (terminalSeenAt.size > MAX_TRACKED_RUNS) {
    const oldest = terminalSeenAt.keys().next().value
    if (oldest !== undefined) terminalSeenAt.delete(oldest)
  }
  return now
}

// Lists one page of executions. params defaults to {} — the backend's own
// default page (1) / page_size (25) apply when omitted, matching
// useExecutions()'s pre-pagination "just give me executions" call shape.
/**
 * List executions, optionally refreshing while an inspector is open.  The
 * refresh policy intentionally belongs to the caller: most list pages are a
 * one-shot browse, while the workflow editor's live inspector benefits from a
 * small, explicit polling interval that a user can turn off.
 */
export function useExecutions(
  params: ListExecutionsParams = {},
  options: { refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: executionKeys.all(params),
    queryFn:  () => executionsApi.list(params),
    refetchInterval: options.refetchInterval,
  })
}

// A lightweight count-only read for stat tiles (e.g. the Dashboard's
// "Completed" tile) — reuses the same paginated endpoint but only reads
// .total, with page_size: 1 so the server does no more row-fetching work
// than necessary for a number nobody renders per-row.
export function useExecutionCount(status?: ExecutionStatus) {
  return useQuery({
    queryKey: [...executionKeys.all({ status }), 'count'] as const,
    queryFn:  () => executionsApi.list({ status, page: 1, pageSize: 1 }),
    select:   (data) => data.total,
  })
}

// Polls every 2 s until the execution reaches a terminal state. Disabled
// when executionId is empty (e.g. the Workflow Builder's execution overlay
// has nothing selected) rather than firing a request with a blank ID.
export function useExecution(executionId: string) {
  return useQuery({
    queryKey: executionKeys.detail(executionId),
    queryFn:  () => executionsApi.get(executionId),
    enabled:  executionId !== '',
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL.includes(status) ? false : 2000
    },
  })
}

// Fetches one page of an execution's real Input/Output logs (FR-C5-007
// Logs panel + canvas real-order mode). Deliberately opt-in via
// `opts.enabled` (default false) — this is a SECOND poll alongside
// useExecution's existing 2s one, and the design review flagged an
// always-on second poll as an unwanted cost. No request fires unless a
// caller explicitly turns it on: today that's either a mounted Logs panel,
// or the Workflow Builder's canvas overlay actively showing a selected
// execution (see WorkflowBuilderPage.tsx).
//
// Polling: if the caller passes `executionStatus` and it's non-terminal,
// polls every 4s (matching the Logs panel's "keep the step list fresh
// while the run is still going" need) unless `pollWhileRunning: false` (a
// fetch used only to compute chronological node order, where re-ordering the
// canvas mid-run isn't worth a second background poll). Either way, a run
// that has turned terminal polls every 1s until its rows are final (see
// LOG_SETTLE_MS above), so both callers end on the complete set of rows.
//
// Final rows never change, so from then on the query is never stale:
// remounting a panel on a run whose rows are already cached (the builder's
// Logs dock re-expanding), reselecting it, or the window regaining focus
// costs no request.
export function useExecutionLogs(
  executionId: string | undefined,
  params: GetExecutionLogsParams = {},
  opts: {
    enabled?: boolean
    executionStatus?: ExecutionStatus
    finishedAt?: string | null
    pollWhileRunning?: boolean
  } = {},
) {
  const enabled = !!executionId && (opts.enabled ?? false)
  const terminal = !!opts.executionStatus && TERMINAL.includes(opts.executionStatus)
  // Recorded during render; idempotent per execution (see firstSeenTerminal).
  const seenAt = terminal && executionId ? firstSeenTerminal(executionId) : null
  const settleUntil = seenAt === null ? 0 : seenAt + (finishedRecently(opts.finishedAt) ? LOG_SETTLE_MS : 0)
  const rowsAreFinal = (query: { state: { dataUpdatedAt: number } }) =>
    seenAt !== null && query.state.dataUpdatedAt > seenAt && Date.now() >= settleUntil

  return useQuery({
    queryKey: executionKeys.logs(executionId ?? '', params),
    queryFn:  () => executionsApi.getLogs(executionId as string, params),
    enabled,
    // Functions, evaluated whenever react-query checks — not values frozen at
    // the last render. A settle-window refetch that returns identical rows
    // doesn't re-render (structural sharing keeps `data`), so a render-time
    // value would stay "stale" after settling and every window refocus
    // would re-download the whole page of rows.
    staleTime: (query) => (rowsAreFinal(query) ? Infinity : 0),
    refetchInterval: (query) => {
      if (!opts.executionStatus) return false
      if (!terminal) return (opts.pollWhileRunning ?? true) ? 4000 : false
      if (rowsAreFinal(query)) return false
      // A failing endpoint isn't hammered: recovery is left to react-query's
      // own retry and to refetch-on-mount/focus, which still fire because
      // non-final rows stay stale.
      if (query.state.status === 'error' && query.state.errorUpdatedAt > (seenAt ?? 0)) return false
      return Date.now() - (seenAt ?? 0) < MAX_CATCH_UP_MS ? 1000 : false
    },
  })
}

export function useTriggerExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (definitionId: string) => executionsApi.trigger(definitionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  })
}
