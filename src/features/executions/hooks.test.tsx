// @vitest-environment jsdom
//
// useExecutionLogs' settle rules: a just-finished run's logs keep polling
// briefly (its last rows land a beat after it turns terminal), rows cached
// before a run turned terminal are always refreshed once, and after that the
// rows are immutable — including across remounts and when nothing re-renders
// (structural sharing keeps `data` when a refetch returns identical rows).
//
// Each test uses its own execution id: first terminal sightings are
// remembered module-wide, on purpose (see hooks.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useExecutionLogs } from './hooks'
import type { ExecutionStatus } from './types'

const getLogsMock = vi.fn()
vi.mock('./api', () => ({
  executionsApi: { getLogs: (...args: unknown[]) => getLogsMock(...args) },
}))

afterEach(() => {
  cleanup()
  getLogsMock.mockReset()
  vi.restoreAllMocks()
  focusManager.setFocused(undefined)
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const PAGE = { logs: [], total: 0, page: 1, page_size: 200 }

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderLogsHook(
  executionId: string,
  initial: { status: ExecutionStatus; finishedAt?: string; pollWhileRunning?: boolean },
  client = makeClient(),
) {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  // Reads only `data`, so react-query's tracked-props optimisation skips the
  // re-render when a refetch returns identical rows — the live condition.
  return renderHook(
    (props: typeof initial) => useExecutionLogs(executionId, { page: 1, pageSize: 200 }, {
      enabled: true, executionStatus: props.status, finishedAt: props.finishedAt, pollWhileRunning: props.pollWhileRunning,
    }).data,
    { wrapper, initialProps: initial },
  )
}

function refocusWindow() {
  focusManager.setFocused(false)
  focusManager.setFocused(true)
}

describe('useExecutionLogs settle rules', () => {
  it('stops refetching a settled run on window focus even though nothing re-rendered', async () => {
    getLogsMock.mockResolvedValue(PAGE)
    const { result } = renderLogsHook('settle-a', { status: 'COMPLETED', finishedAt: new Date().toISOString() })
    // Wait for the data to RENDER, not just the request — that render is the
    // last one; everything after it happens without a re-render.
    await waitFor(() => expect(result.current).toBeDefined())

    // Jump past the 5s settle window, let the in-flight 1s settle tick land
    // (it notices the window closed and stops the interval), then refocus.
    const realNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 6000)
    await wait(1500)
    const settledCalls = getLogsMock.mock.calls.length

    refocusWindow()
    await wait(300)
    expect(getLogsMock).toHaveBeenCalledTimes(settledCalls)
  })

  it('polls a just-finished run while it settles, timed on the browser clock even when the server clock runs ahead', async () => {
    getLogsMock.mockResolvedValue(PAGE)
    // finished_at 10s in the browser's future — a drifted server clock.
    renderLogsHook('settle-b', { status: 'COMPLETED', finishedAt: new Date(Date.now() + 10_000).toISOString() })
    await waitFor(() => expect(getLogsMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 })
  })

  it('refreshes rows cached mid-run once the run is terminal, even when it finished long ago by the server clock', async () => {
    getLogsMock.mockResolvedValue(PAGE)
    // The canvas's run-order caller: fetched once while RUNNING, no mid-run poll.
    const { result, rerender } = renderLogsHook('settle-c', { status: 'RUNNING', pollWhileRunning: false })
    await waitFor(() => expect(result.current).toBeDefined())
    await wait(300)
    expect(getLogsMock).toHaveBeenCalledTimes(1)

    // Seen terminal with a finished_at far outside the "recent" tolerance (a
    // clock off by minutes). The pre-terminal rows may miss the last steps,
    // so exactly one catch-up fetch must still happen...
    rerender({ status: 'COMPLETED', finishedAt: '2026-01-01T00:00:00.000Z', pollWhileRunning: false })
    await waitFor(() => expect(getLogsMock).toHaveBeenCalledTimes(2), { timeout: 3000 })

    // ...and then nothing more: not by interval, not on focus.
    await wait(1500)
    refocusWindow()
    await wait(300)
    expect(getLogsMock).toHaveBeenCalledTimes(2)
  })

  it("doesn't keep polling a terminal run's logs once the endpoint has failed", async () => {
    getLogsMock.mockRejectedValue(new Error('500'))
    renderLogsHook('settle-e', { status: 'COMPLETED', finishedAt: new Date().toISOString() })
    await waitFor(() => expect(getLogsMock).toHaveBeenCalledTimes(1))

    // No 1s catch-up ticks against a failing endpoint (the test client has
    // retry: false; recovery is left to retry and refetch-on-mount/focus).
    await wait(2500)
    expect(getLogsMock).toHaveBeenCalledTimes(1)
  })

  it("doesn't restart the settle window when a panel remounts (the Logs dock re-expanding)", async () => {
    getLogsMock.mockResolvedValue(PAGE)
    const client = makeClient()
    const finishedAt = new Date().toISOString()
    const first = renderLogsHook('settle-d', { status: 'COMPLETED', finishedAt }, client)
    await waitFor(() => expect(first.result.current).toBeDefined())

    const realNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 6000)
    await wait(1500) // the settle tick in flight lands, then polling stops
    first.unmount()
    const settledCalls = getLogsMock.mock.calls.length

    // Same run, same cache, a brand-new hook instance: no mount refetch, no
    // fresh 5s of polling.
    const second = renderLogsHook('settle-d', { status: 'COMPLETED', finishedAt }, client)
    expect(second.result.current).toBeDefined()
    await wait(1500)
    expect(getLogsMock).toHaveBeenCalledTimes(settledCalls)
  })
})
