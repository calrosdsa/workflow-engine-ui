// @vitest-environment jsdom
//
// Covers the Logs panel's most consequential pieces of logic: (1) the
// DataTable-vs-<pre> shape-detection fallback actually wired up end to end
// (not just payload-shape.ts's own unit tests), (2) the dropped_payload
// notice replacing an empty Input/Output state rather than silently showing
// nothing, and (3) step labels resolving to the canvas's own node names.
// The trigger-pinned-first / step-list rendering is exercised incidentally
// by every test here reading row labels.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ExecutionLogsPanel } from './ExecutionLogsPanel'
import type { ExecutionLogsResponse, ExecutionNodeLog } from './types'

const getLogsMock = vi.fn()
vi.mock('./api', () => ({
  executionsApi: { getLogs: (...args: unknown[]) => getLogsMock(...args) },
}))

afterEach(() => {
  cleanup()
  getLogsMock.mockReset()
})

function baseLog(overrides: Partial<ExecutionNodeLog>): ExecutionNodeLog {
  return {
    id: 'log', execution_id: 'exec-1', node_id: 'node', node_type: 'node_type', kind: 'node',
    attempt: 1, status: 'COMPLETED', started_at: '2026-09-12T10:00:00Z', finished_at: '2026-09-12T10:00:00Z',
    duration_ms: 10, input: null, output: null, error_message: null, dropped_payload: false,
    chunk_index: null, chunk_count: null, item_count: null, failed_item_count: null, trace_id: null, span_id: null,
    ...overrides,
  }
}

const TRIGGER_LOG = baseLog({
  id: 'log-trigger', node_id: 'trigger-1', node_type: 'trigger', kind: 'trigger',
  started_at: '2026-09-12T10:00:00Z', output: { source: 'webhook' },
})
const TABLE_LOG = baseLog({
  id: 'log-fetch', node_id: 'fetch-1', node_type: 'fetch_records', kind: 'node',
  started_at: '2026-09-12T10:00:01Z',
  output: [{ id: '1', name: 'Acme' }, { id: '2', name: 'Globex' }],
})
const DROPPED_LOG = baseLog({
  id: 'log-http', node_id: 'http-1', node_type: 'http_request', kind: 'node',
  started_at: '2026-09-12T10:00:02Z', status: 'FAILED',
  error_message: 'boom', dropped_payload: true,
})

function respond(logs: ExecutionNodeLog[]): ExecutionLogsResponse {
  return { logs, total: logs.length, page: 1, page_size: 50 }
}

function renderPanel(props: { nodeLabels?: Record<string, string> } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ExecutionLogsPanel executionId="exec-1" executionStatus="COMPLETED" {...props} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

// Rows are the step list's own buttons; the detail header repeats the
// selected step's label as an <h3>, so query the row by role, not text.
const stepRow = (name: RegExp) => screen.getByRole('button', { name })

describe('ExecutionLogsPanel', () => {
  it('selects the trigger row first, opens on Output, and falls back to a raw JSON dump for a bare-object payload', async () => {
    getLogsMock.mockResolvedValue(respond([TRIGGER_LOG, TABLE_LOG]))
    renderPanel()

    await waitFor(() => expect(stepRow(/Trigger/)).toBeTruthy())
    expect(stepRow(/Trigger/).getAttribute('aria-current')).toBe('true')
    // { source: 'webhook' } is a bare object, not an array of records — must
    // stay a <pre> dump, never a DataTable.
    await waitFor(() => expect(screen.getByText(/"source"/)).toBeTruthy())
    expect(document.querySelector('table')).toBeNull()

    // Radix's TabsTrigger activates on mousedown (see its own source), not
    // on click — fireEvent.click alone leaves the tab inactive in jsdom.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Input' }))
    // Trigger's Input is null -> the "no data" message, not a crash or blank.
    expect(screen.getByText('No data captured for this step.')).toBeTruthy()
  })

  it('renders a DataTable with an item count for an array-of-uniform-objects output', async () => {
    getLogsMock.mockResolvedValue(respond([TRIGGER_LOG, TABLE_LOG]))
    renderPanel()

    // No canvas label passed -> the node type's registry label, never the
    // raw "fetch_records" type id.
    await waitFor(() => expect(stepRow(/Fetch Records/)).toBeTruthy())
    fireEvent.click(stepRow(/Fetch Records/))

    await waitFor(() => expect(document.querySelector('table')).not.toBeNull())
    expect(screen.getByText('2 items')).toBeTruthy()
    expect(screen.getByText('id')).toBeTruthy()
    expect(screen.getByText('name')).toBeTruthy()
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('Globex')).toBeTruthy()
    expect(screen.getByText('Success in 10ms')).toBeTruthy()
  })

  it('switches a table payload to its full JSON, wrapper fields included', async () => {
    const wrapped = baseLog({
      id: 'log-wrapped', node_id: 'fetch-2', node_type: 'fetch_records', kind: 'node',
      output: { node_output: { records: [{ id: '1', name: 'Acme' }], count: 1 } },
    })
    getLogsMock.mockResolvedValue(respond([wrapped]))
    renderPanel()

    await waitFor(() => expect(document.querySelector('table')).not.toBeNull())
    expect(screen.getByText('1 item')).toBeTruthy()
    // The table shows only the unwrapped records; "count" lives on the
    // wrapper, so only the JSON view can surface it.
    expect(screen.queryByText(/"count"/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }))
    expect(document.querySelector('table')).toBeNull()
    expect(screen.getByText(/"count": 1/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'JSON' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps polling briefly after a run turns terminal so its last rows can land', async () => {
    getLogsMock.mockResolvedValue(respond([TRIGGER_LOG]))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <ExecutionLogsPanel executionId="exec-1" executionStatus="COMPLETED" executionFinishedAt={new Date().toISOString()} />
        </I18nProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(getLogsMock.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 })
  })

  it('fetches a long-finished run once and never polls it', async () => {
    getLogsMock.mockResolvedValue(respond([TRIGGER_LOG]))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <ExecutionLogsPanel executionId="exec-1" executionStatus="COMPLETED" executionFinishedAt="2026-01-01T00:00:00.000Z" />
        </I18nProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(getLogsMock).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(getLogsMock).toHaveBeenCalledTimes(1)
  })

  it('labels steps with the canvas node names when the host passes them', async () => {
    getLogsMock.mockResolvedValue(respond([TRIGGER_LOG, TABLE_LOG]))
    renderPanel({ nodeLabels: { 'trigger-1': 'When invoice is paid', 'fetch-1': 'Load customers' } })

    await waitFor(() => expect(stepRow(/Load customers/)).toBeTruthy())
    expect(stepRow(/When invoice is paid/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Fetch Records/ })).toBeNull()
  })

  it('keeps the chosen Input/Output view when switching steps', async () => {
    getLogsMock.mockResolvedValue(respond([TRIGGER_LOG, TABLE_LOG]))
    renderPanel()

    await waitFor(() => expect(stepRow(/Trigger/)).toBeTruthy())
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Input' }))
    fireEvent.click(stepRow(/Fetch Records/))

    await waitFor(() => expect(stepRow(/Fetch Records/).getAttribute('aria-current')).toBe('true'))
    expect(screen.getByRole('tab', { name: 'Input' }).getAttribute('data-state')).toBe('active')
    expect(screen.getByText('No data captured for this step.')).toBeTruthy()
  })

  // Pins the fix for a real gap found comparing this panel against n8n's own
  // execution log table: a nested object field (address/company-shaped, the
  // exact real HTTP Request output shape) was rendering as one unreadable
  // JSON.stringify'd line per cell. NestedFieldValue instead renders it as
  // one "key : value" line per field, indenting further for a doubly-nested
  // object (address.geo) — this asserts both, not just the outer level.
  const NESTED_LOG = baseLog({
    id: 'log-nested', node_id: 'http-2', node_type: 'http_request', kind: 'node',
    started_at: '2026-09-12T10:00:03Z',
    output: [{
      name: 'Leanne Graham',
      address: { city: 'Gwenborough', street: 'Kulas Light', geo: { lat: '-37.3159', lng: '81.1496' } },
    }],
  })

  it('renders a nested object field as indented key:value lines, not raw JSON', async () => {
    getLogsMock.mockResolvedValue(respond([NESTED_LOG]))
    renderPanel()

    await waitFor(() => expect(stepRow(/HTTP Request/)).toBeTruthy())

    // The outer object's own fields...
    await waitFor(() => expect(screen.getByText('city')).toBeTruthy())
    expect(screen.getByText('Gwenborough')).toBeTruthy()
    expect(screen.getByText('street')).toBeTruthy()
    // ...and the doubly-nested "geo" object's own fields, one level deeper.
    expect(screen.getByText('geo')).toBeTruthy()
    expect(screen.getByText('lat')).toBeTruthy()
    expect(screen.getByText('-37.3159')).toBeTruthy()
    // Never the old single-line JSON dump for this value.
    expect(screen.queryByText(/"city":"Gwenborough"/)).toBeNull()
  })

  it('shows the dropped-payload notice instead of an empty state, even though input/output are both null', async () => {
    getLogsMock.mockResolvedValue(respond([DROPPED_LOG]))
    renderPanel()

    await waitFor(() => expect(stepRow(/HTTP Request/)).toBeTruthy())
    expect(screen.getByText('Payload not captured (system under load)')).toBeTruthy()
    // The error is still surfaced independently of the dropped payload.
    expect(screen.getByText('boom')).toBeTruthy()
    expect(screen.getByText('Error in 10ms')).toBeTruthy()
  })

  it('shows the empty state when the execution has no log rows', async () => {
    getLogsMock.mockResolvedValue(respond([]))
    renderPanel()

    await waitFor(() => expect(screen.getByText('No steps recorded for this execution.')).toBeTruthy())
  })

  it('labels a loop-chunk row by item range, not by chunk_index/chunk_count directly', async () => {
    // chunk_index is the chunk's own source-item OFFSET (e.g. 500 for the
    // second 500-item chunk), not an ordinal chunk number, and chunk_count is
    // a separately-scaled total chunk count -- combining them as "chunk
    // {chunk_index} of {chunk_count}" would render as nonsense ("chunk 500 of
    // 8"). This pins the corrected item-range label so a regression can't
    // silently reintroduce that mismatch.
    const LOOP_CHUNK_LOG = baseLog({
      id: 'log-loop', node_id: 'iter-1', node_type: 'iterator', kind: 'loop_chunk',
      started_at: '2026-09-12T10:00:03Z',
      chunk_index: 500, chunk_count: 8, item_count: 500, failed_item_count: 3,
    })
    getLogsMock.mockResolvedValue(respond([LOOP_CHUNK_LOG]))
    renderPanel()

    await waitFor(() =>
      expect(stepRow(/Loop body — items 501–1000 \(500 items, 3 failed\)/)).toBeTruthy(),
    )
  })
})
