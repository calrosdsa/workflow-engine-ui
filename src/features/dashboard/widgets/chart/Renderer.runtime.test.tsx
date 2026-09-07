// @vitest-environment jsdom
//
// Reproduction check for a "Maximum update depth exceeded" React warning
// observed live in the browser after: opening the runtime time-range
// popover, opening its nested custom-range DatePicker calendar, then
// switching the bucket SelectMenu to "Week" without closing the popover
// first. This test mounts ChartRenderer directly (mode="runtime") against
// a date-bucketed config — the one config shape that renders the
// bucket/time-range controls at all — and drives the bucket switch, the
// ad-hoc filter Apply, and Reset, asserting no such warning/error fires.
//
// IMPORTANT — this suite does NOT rule out a real render loop: ResizeObserver
// is stubbed to a no-op below, so Recharts' ResponsiveContainer and
// react-grid-layout's WidthProvider never measure and never re-fire, which
// is exactly the mechanism a real measure/render feedback loop needs. A
// live-browser check later found a genuine infinite request storm (see
// app-builder-dashboard-chart-runtime-controls memory) that reproduces on
// ANY runtime route, chart widgets included or not, and persists even with
// this feature's own files reverted to HEAD — i.e. it's a pre-existing,
// unrelated app-shell bug this suite was never capable of catching. Keep
// these tests (they do rule out a state/queryKey loop in this widget's own
// merge logic), but don't treat a green run here as loop-free proof.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChartRenderer } from './Renderer'
import { formsApi } from '@/features/forms/api'
import { useForm } from '@/features/forms/hooks'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { ChartWidgetConfig } from './schema'
import type { FormDefinition } from '@/features/forms/types'

afterEach(() => cleanup())

vi.mock('@/features/forms/hooks', () => ({
  useForm: vi.fn(),
}))

// Radix Select/Popover + Recharts' ResponsiveContainer all lean on browser
// APIs jsdom doesn't implement — same stub set combobox-aria.test.tsx
// already established for exactly this Radix-in-jsdom gap.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const FORM: FormDefinition = {
  id: 'deals',
  name: 'Deal',
  slug: 'deals',
  fields: [
    { name: 'stage', label: 'Stage', type: 'enum', enum_values: ['Open', 'Closed'] },
    { name: 'amount', label: 'Amount', type: 'decimal' },
    { name: 'close_date', label: 'Expected Close Date', type: 'date' },
  ],
} as unknown as FormDefinition

const CONFIG: ChartWidgetConfig = {
  formId: 'deals',
  chartType: 'bar',
  groupBy: { field: 'close_date', bucket: 'month' },
  series: [{ fn: 'sum', field: 'amount', label: 'Pipeline Value' }],
  sortBy: 'group',
  sortDir: 'asc',
  limit: 20,
  legend: true,
}

function renderChart() {
  vi.mocked(useForm).mockReturnValue({ data: FORM, isLoading: false, isError: false } as ReturnType<typeof useForm>)
  vi.spyOn(formsApi, 'aggregateRecords').mockResolvedValue({
    groups: [
      { key: '2026-09-01', values: [210000] },
      { key: '2026-10-01', values: [260000] },
    ],
  })

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <ChartRenderer
          config={CONFIG}
          instance={{ id: 'test_time_chart', type: 'chart', layout: { x: 0, y: 0, w: 12, h: 6 }, chrome: 'card', config: CONFIG }}
          clientId="c1"
          appId="a1"
          menus={[]}
          onNavigate={() => {}}
          mode="runtime"
        />
      </QueryClientProvider>
    </I18nProvider>,
  )
}

describe('ChartRenderer runtime controls — no infinite update loop', () => {
  it('mounts with time-range + bucket controls visible for a date groupBy', async () => {
    renderChart()
    await waitFor(() => expect(screen.getByTitle('Time range')).toBeTruthy())
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('switching the bucket to Week does not throw or warn about update depth', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderChart()
    await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy())
    await waitFor(() => expect(formsApi.aggregateRecords).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('combobox'))
    const weekOption = await screen.findByText('Week')
    fireEvent.click(weekOption)

    // Let any queued re-renders/effects settle, then assert the call count
    // is small and bounded — a genuine runaway loop would blow well past
    // this (the live-browser incident logged 372 console errors), while a
    // harmless extra render or two from the value change is fine.
    await new Promise((r) => setTimeout(r, 100))
    expect(vi.mocked(formsApi.aggregateRecords).mock.calls.length).toBeLessThan(20)

    const maxDepthCalls = errorSpy.mock.calls.filter((args) => String(args[0]).includes('Maximum update depth'))
    expect(maxDepthCalls).toEqual([])
    errorSpy.mockRestore()
  })

  it('applying an ad-hoc filter then Reset does not throw or warn about update depth', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderChart()
    await waitFor(() => expect(screen.getByTitle('Filter')).toBeTruthy())

    fireEvent.click(screen.getByTitle('Filter'))
    const conditionButton = await screen.findByRole('button', { name: /condition/i })
    fireEvent.click(conditionButton)
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }))

    // "Reset all" (ActiveFiltersBar) exercises the same clear-the-ad-hoc-
    // filter path ChartMenu's "Reset" item does, without fighting Radix
    // DropdownMenu's pointerdown-based open sequence under jsdom's
    // synthetic fireEvent.click (a known friction point, separate from
    // what this test is actually checking).
    fireEvent.click(await screen.findByRole('button', { name: /reset all/i }))

    await new Promise((r) => setTimeout(r, 100))
    const maxDepthCalls = errorSpy.mock.calls.filter((args) => String(args[0]).includes('Maximum update depth'))
    expect(maxDepthCalls).toEqual([])
    errorSpy.mockRestore()
  })

  it('opening the time-range popover, then switching bucket WITHOUT closing it first, does not loop', async () => {
    // Closest reproduction of the exact live-browser sequence: Time range
    // popover opened, its nested custom-range calendar opened, then the
    // bucket Select opened and changed — all without ever closing the
    // first popover. If this stays clean, the live incident was a
    // multi-overlay interaction/automation-tool event-injection artifact,
    // not a defect in this component's render/merge logic.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderChart()
    await waitFor(() => expect(screen.getByRole('combobox')).toBeTruthy())

    fireEvent.click(screen.getByTitle('Time range'))
    fireEvent.click(await screen.findByText('Custom range'))

    fireEvent.click(screen.getByRole('combobox'))
    const weekOption = await screen.findByText('Week')
    fireEvent.click(weekOption)

    await new Promise((r) => setTimeout(r, 100))
    // A genuine runaway loop is qualitatively different from "a few extra
    // renders from a second open overlay" — the live incident logged 372
    // console errors in a few seconds. This bound only needs to separate
    // those two cases, not pin an exact count.
    expect(vi.mocked(formsApi.aggregateRecords).mock.calls.length).toBeLessThan(20)

    const maxDepthCalls = errorSpy.mock.calls.filter((args) => String(args[0]).includes('Maximum update depth'))
    expect(maxDepthCalls).toEqual([])
    errorSpy.mockRestore()
  })
})
