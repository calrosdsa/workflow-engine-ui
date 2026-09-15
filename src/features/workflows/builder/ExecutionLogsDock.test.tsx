// @vitest-environment jsdom
//
// The dock's one subtle contract: ExecutionLogsPanel polls whenever it is
// MOUNTED, so a collapsed dock must unmount it (zero log requests), and
// expanding must mount it against the shared page-1/200-row query the canvas
// run-order fetch already uses.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { Execution } from '@/features/executions/types'
import { ExecutionLogsDock, DOCK_LOGS_PAGE_SIZE } from './ExecutionLogsDock'
import { useExecutionOverlayStore } from './execution-overlay-store'

const getLogsMock = vi.fn()
vi.mock('@/features/executions/api', () => ({
  executionsApi: { getLogs: (...args: unknown[]) => getLogsMock(...args) },
}))

const EXECUTION: Execution = {
  execution_id: 'exec-1',
  workflow_definition_id: 'wf-1',
  status: 'COMPLETED',
  created_at: '2026-09-12T10:00:00Z',
  started_at: '2026-09-12T10:00:00.000Z',
  finished_at: '2026-09-12T10:00:01.200Z',
}

beforeEach(() => {
  useExecutionOverlayStore.setState({ logsDockOpen: false })
  getLogsMock.mockResolvedValue({ logs: [], total: 0, page: 1, page_size: DOCK_LOGS_PAGE_SIZE })
})

afterEach(() => {
  cleanup()
  getLogsMock.mockReset()
})

function renderDock(execution: Execution | null = EXECUTION, loading = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ExecutionLogsDock execution={execution} loading={loading} nodeLabels={{}} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('ExecutionLogsDock', () => {
  it('starts as a collapsed Logs bar with the run summary and fires no log requests', () => {
    renderDock()

    const bar = screen.getByRole('button', { name: /Expand logs/ })
    expect(bar.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Success in 1.2s')).toBeTruthy()
    expect(getLogsMock).not.toHaveBeenCalled()
  })

  it('mounts the panel on expand against the shared page-1 query, and unmounts it on collapse', async () => {
    renderDock()

    fireEvent.click(screen.getByRole('button', { name: /Expand logs/ }))
    expect(useExecutionOverlayStore.getState().logsDockOpen).toBe(true)
    await waitFor(() => expect(getLogsMock).toHaveBeenCalledWith('exec-1', { page: 1, pageSize: DOCK_LOGS_PAGE_SIZE }))
    await waitFor(() => expect(screen.getByText('No steps recorded for this execution.')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /Collapse logs/ }))
    expect(useExecutionOverlayStore.getState().logsDockOpen).toBe(false)
    expect(screen.queryByText('No steps recorded for this execution.')).toBeNull()
    expect(screen.getByRole('button', { name: /Expand logs/ })).toBeTruthy()
  })

  it('keeps one disclosure button — and keyboard focus — across expand and collapse', async () => {
    renderDock()

    const toggle = screen.getByRole('button', { name: /Expand logs/ })
    toggle.focus()
    fireEvent.click(toggle)

    // The same element, now the collapse control: focus never drops to
    // <body>, and aria-expanded flips on the element the user is on.
    const collapse = await screen.findByRole('button', { name: /Collapse logs/ })
    expect(collapse).toBe(toggle)
    expect(document.activeElement).toBe(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).not.toBeNull()
    // The resize handle is its own element, never the old bar morphed into it.
    expect(screen.getByRole('button', { name: 'Resize logs panel' })).not.toBe(toggle)

    fireEvent.click(toggle)
    expect(document.activeElement).toBe(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBeNull()
  })

  it('shows a prompt instead of a panel when no run is selected', () => {
    useExecutionOverlayStore.setState({ logsDockOpen: true })
    renderDock(null)

    expect(screen.getByText('Select an execution to see its logs, or run the workflow.')).toBeTruthy()
    expect(getLogsMock).not.toHaveBeenCalled()
  })

  it('resizes from the keyboard via its top-edge handle', () => {
    useExecutionOverlayStore.setState({ logsDockOpen: true })
    renderDock(null)

    const dock = screen.getByRole('region', { name: 'Logs' })
    const before = parseInt(dock.style.height, 10)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize logs panel' }), { key: 'ArrowUp' })
    expect(parseInt(dock.style.height, 10)).toBeGreaterThan(before)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize logs panel' }), { key: 'ArrowDown' })
    expect(parseInt(dock.style.height, 10)).toBe(before)
  })
})
