import { useRef } from 'react'
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
// final step's row lands. For LOG_SETTLE_MS after a caller first sees a
// just-finished run as terminal, its logs keep "settling" (polling briefly)
// instead of freezing one step short; only then are they treated as
// immutable.
//
// The window is timed on the browser's clock, from that first sighting —
// never from the server's finished_at, whose clock (Postgres in a Docker/
// WSL2 VM in dev) was seen drifting ~10s from the browser's, which stretched
// a finished_at-based window to 15s of polling. finished_at only decides
// whether the run is recent enough to settle at all, with a tolerance wide
// enough to absorb that drift.
const LOG_SETTLE_MS = 5000
const RECENT_FINISH_MS = 60_000

function finishedRecently(finishedAt?: string | null): boolean {
  if (!finishedAt) return false
  const finished = Date.parse(finishedAt)
  return !Number.isNaN(finished) && Math.abs(Date.now() - finished) < RECENT_FINISH_MS
}

// Lists one page of executions. params defaults to {} — the backend's own
// default page (1) / page_size (25) apply when omitted, matching
// useExecutions()'s pre-pagination "just give me executions" call shape.
export function useExecutions(params: ListExecutionsParams = {}) {
  return useQuery({
    queryKey: executionKeys.all(params),
    queryFn:  () => executionsApi.list(params),
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
// that has just turned terminal (see `finishedAt` / LOG_SETTLE_MS above)
// polls every 1s while it settles, so both callers end on the complete set
// of rows.
//
// A terminal, settled run's logs never change, so such a caller gets
// staleTime: Infinity — remounting a panel on a run whose rows are already
// cached (the builder's Logs dock re-expanding), or the window regaining
// focus, costs no request.
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

  // When THIS caller first saw this execution as terminal (keyed by id: the
  // builder's overlay caller follows the selection without remounting).
  // Recording it during render is idempotent — a re-render for the same id
  // never moves it.
  const firstSeenTerminal = useRef<{ id: string; at: number } | null>(null)
  if (terminal && executionId && firstSeenTerminal.current?.id !== executionId) {
    firstSeenTerminal.current = { id: executionId, at: Date.now() }
  }
  const settling = () => {
    const seen = firstSeenTerminal.current
    return terminal && !!seen && seen.id === executionId
      && finishedRecently(opts.finishedAt)
      && Date.now() - seen.at < LOG_SETTLE_MS
  }

  return useQuery({
    queryKey: executionKeys.logs(executionId ?? '', params),
    queryFn:  () => executionsApi.getLogs(executionId as string, params),
    enabled,
    // A function, evaluated whenever react-query checks staleness — not a
    // value frozen at the last render. A settle-window refetch that returns
    // identical rows doesn't re-render (structural sharing keeps `data`), so
    // a render-time value would stay 0 after settling and every window
    // refocus would re-download the whole page of rows.
    staleTime: () => (terminal && !settling() ? Infinity : 0),
    refetchInterval: () => {
      if (!opts.executionStatus) return false
      if (!terminal) return (opts.pollWhileRunning ?? true) ? 4000 : false
      return settling() ? 1000 : false
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
