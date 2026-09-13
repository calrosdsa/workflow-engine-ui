// @vitest-environment jsdom
//
// useExecutionLogs' settle window: a just-finished run's logs keep polling
// briefly (its last rows may land a beat after the run turns terminal), then
// become immutable — including when nothing re-renders in between, which is
// the normal case once rows stop changing (structural sharing keeps `data`).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useExecutionLogs } from './hooks'

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

function renderLogsHook(finishedAt: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  // Reads only `data`, so react-query's tracked-props optimisation skips the
  // re-render when a refetch returns identical rows — the live condition.
  return renderHook(
    () => useExecutionLogs('exec-1', { page: 1, pageSize: 200 }, { enabled: true, executionStatus: 'COMPLETED', finishedAt }).data,
    { wrapper },
  )
}

describe('useExecutionLogs settle window', () => {
  it('stops refetching a settled run on window focus even though nothing re-rendered', async () => {
    getLogsMock.mockResolvedValue({ logs: [], total: 0, page: 1, page_size: 200 })
    const { result } = renderLogsHook(new Date().toISOString())
    // Wait for the data to RENDER, not just the request — that render is the
    // last one; everything after it happens without a re-render.
    await waitFor(() => expect(result.current).toBeDefined())

    // Jump past the 5s settle window, let the in-flight 1s settle tick land
    // (it notices the window closed and stops the interval), then refocus.
    const realNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 6000)
    await wait(1500)
    const settledCalls = getLogsMock.mock.calls.length

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await wait(300)
    expect(getLogsMock).toHaveBeenCalledTimes(settledCalls)
  })

  it('polls a just-finished run while it settles, timed on the browser clock even when the server clock runs ahead', async () => {
    getLogsMock.mockResolvedValue({ logs: [], total: 0, page: 1, page_size: 200 })
    // finished_at 10s in the browser's future — a drifted server clock.
    renderLogsHook(new Date(Date.now() + 10_000).toISOString())
    await waitFor(() => expect(getLogsMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 })
  })
})
