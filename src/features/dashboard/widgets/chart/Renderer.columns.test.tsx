// @vitest-environment jsdom
//
// The aggregate response now describes its own columns, which is what lets a
// money measure render as money. Before it, the renderer had to go back to
// the form definition and guess which field produced which positional value
// — so formatting worked on a stat tile, where there is exactly one known
// source field, and nowhere else.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChartRenderer } from './Renderer'
import { formsApi } from '@/features/forms/api'
import { useForm } from '@/features/forms/hooks'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { ChartWidgetConfig } from './schema'
import type { FormDefinition } from '@/features/forms/types'
import type { AggregateRecordsResponse } from '@/features/forms/api'

afterEach(() => cleanup())

vi.mock('@/features/forms/hooks', () => ({ useForm: vi.fn() }))

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

const MONEY = { style: 'currency', currency_symbol: 'Bs ', decimals: 2 }

// Deliberately carries NO number_format on the field itself, so a passing
// assertion can only come from the response's column descriptor.
const FORM: FormDefinition = {
  id: 'invoices',
  name: 'Sales Invoice',
  slug: 'invoices',
  fields: [
    { name: 'status', label: 'Status', type: 'enum', enum_values: ['Paid', 'Open'] },
    { name: 'amount', label: 'Amount', type: 'decimal' },
  ],
} as unknown as FormDefinition

const STAT_CONFIG: ChartWidgetConfig = {
  formId: 'invoices',
  chartType: 'stat',
  series: [{ fn: 'sum', field: 'amount' }],
  sortBy: 'group', sortDir: 'asc', limit: 20, legend: false,
}

function renderStat(response: AggregateRecordsResponse) {
  vi.mocked(useForm).mockReturnValue({ data: FORM, isLoading: false, isError: false } as ReturnType<typeof useForm>)
  vi.spyOn(formsApi, 'aggregateRecords').mockResolvedValue(response)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <ChartRenderer
          config={STAT_CONFIG}
          instance={{ id: 'stat', type: 'chart', layout: { x: 0, y: 0, w: 4, h: 4 }, chrome: 'card', config: STAT_CONFIG }}
          clientId="c1" appId="a1" menus={[]} onNavigate={() => {}} mode="runtime"
        />
      </QueryClientProvider>
    </I18nProvider>,
  )
}

describe('chart formatting from the result column descriptor', () => {
  it('formats a measure using the format the response reports', async () => {
    renderStat({
      groups: [{ key: '', values: [1234.5] }],
      columns: [{ role: 'measure', field: 'amount', label: 'Amount', fn: 'sum', number_format: MONEY }],
    } as AggregateRecordsResponse)

    await waitFor(() => expect(screen.getByText(/Bs\s?1,234\.50/)).toBeTruthy())
  })

  // A row count is unitless whatever it counted — the backend omits the
  // format for a count, and the renderer must not invent one.
  it('leaves a count unformatted', async () => {
    renderStat({
      groups: [{ key: '', values: [4] }],
      columns: [{ role: 'measure', label: 'Count', fn: 'count' }],
    } as AggregateRecordsResponse)

    await waitFor(() => expect(screen.getByText('4')).toBeTruthy())
    expect(screen.queryByText(/Bs/)).toBeNull()
  })

  // An older backend sends no columns at all; the tile must keep rendering
  // rather than throw, falling back to the previous behavior.
  it('degrades to the unformatted number when the response has no columns', async () => {
    renderStat({ groups: [{ key: '', values: [99] }] } as AggregateRecordsResponse)

    await waitFor(() => expect(screen.getByText('99')).toBeTruthy())
  })
})
