// @vitest-environment jsdom
//
// ReportMenuRuntime is the "report" menu type's own on-screen viewer —
// resolves a saved report via useRuntimeReport (POST /report-definitions/
// {id}/runtime) and renders its blocks directly, as opposed to Preview's
// byte-faithful export. This suite mocks @/features/reports/hooks directly
// (same convention Renderer.runtime.test.tsx already established for
// @/features/forms/hooks) rather than driving a real network round trip,
// since what's under test is this component's OWN dispatch/drill-down/
// auto-run logic, not react-query or the fetch layer.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ReportMenuRuntime } from './ReportMenuRuntime'
import { useReport, useRuntimeReport } from '@/features/reports/hooks'
import { emptyReportDefinition } from '@/features/reports/types'
import type { ReportDefinitionRow, ReportArgument } from '@/features/reports/types'
import type { RuntimeReportResult } from '@/features/reports/api'
import type { Menu, ReportMenuConfig } from '../types'

afterEach(cleanup)

vi.mock('@/features/reports/hooks', () => ({
  useReport: vi.fn(),
  useRuntimeReport: vi.fn(),
}))

function menu(reportDefinitionId: string): Menu {
  return {
    id: 'm-1',
    app_id: 'a-1',
    parent_id: null,
    menu_type: 'report',
    slug: 'sales-report',
    name: 'Sales Report',
    sort_order: 0,
    config: { report_definition_id: reportDefinitionId } satisfies ReportMenuConfig,
    permission_mode: 'all',
    required_role_ids: [],
    hidden_from_nav: false,
    created_at: '',
    updated_at: '',
  }
}

function reportRow(over: { arguments?: ReportArgument[] } = {}): ReportDefinitionRow {
  return {
    id: 'rep-1',
    name: 'Sales Report',
    definition: { ...emptyReportDefinition('Sales Report'), arguments: over.arguments },
    created_at: '',
    updated_at: '',
  }
}

function mockHooks(over: {
  row?: ReportDefinitionRow | undefined
  loading?: boolean
  data?: RuntimeReportResult
  isPending?: boolean
  isError?: boolean
  mutate?: (args?: Record<string, unknown>) => void
}) {
  vi.mocked(useReport).mockReturnValue({
    data: over.row, isLoading: over.loading ?? false,
  } as ReturnType<typeof useReport>)
  vi.mocked(useRuntimeReport).mockReturnValue({
    data: over.data, isPending: over.isPending ?? false, isError: over.isError ?? false, error: null,
    mutate: over.mutate ?? vi.fn(), mutateAsync: vi.fn(), reset: vi.fn(),
  } as unknown as ReturnType<typeof useRuntimeReport>)
}

describe('ReportMenuRuntime — auto-run', () => {
  it('auto-runs (calls mutate) on mount when the report has no arguments to prompt for', () => {
    const mutate = vi.fn()
    mockHooks({ row: reportRow(), mutate })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('does NOT auto-run when a required argument has no default — shows the filter bar instead', () => {
    const mutate = vi.fn()
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text', required: true }]
    mockHooks({ row: reportRow({ arguments: argumentList }), mutate })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('Region')).toBeTruthy()
    expect(screen.getByRole('button', { name: /run/i })).toBeTruthy()
  })

  it('Run button is disabled while a required argument is unfilled, and calls mutate once filled', () => {
    const mutate = vi.fn()
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text', required: true }]
    mockHooks({ row: reportRow({ arguments: argumentList }), mutate })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)

    const runButton = screen.getByRole('button', { name: /run/i }) as HTMLButtonElement
    expect(runButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'West' } })
    expect(runButton.disabled).toBe(false)
    fireEvent.click(runButton)
    expect(mutate).toHaveBeenCalledWith({ region: 'West' })
  })
})

describe('ReportMenuRuntime — block rendering', () => {
  it('renders a text block verbatim', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'Sales Report', blocks: [{ id: 'b1', type: 'text', text: 'Q3 summary' }] },
    })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.getByText('Q3 summary')).toBeTruthy()
  })

  it('renders an image block', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'Sales Report', blocks: [{ id: 'b1', type: 'image', image: { link_url: 'https://example.test/x.png', alt: 'Logo' } }] },
    })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)
    const img = screen.getByAltText('Logo') as HTMLImageElement
    expect(img.src).toBe('https://example.test/x.png')
  })

  it('renders a table block\'s headers and cell text', () => {
    mockHooks({
      row: reportRow(),
      data: {
        name: 'Sales Report',
        blocks: [{
          id: 'b1', type: 'table', headers: ['Name', 'Amount'], form_id: 'invoices',
          rows: [{ cells: [{ text: 'Acme' }, { text: '100.00', num: 100 }], source_id: 'inv-1' }],
        }],
      },
    })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.getByText('100.00')).toBeTruthy()
  })

  it('splits a has_total_row block\'s last row into the DataTable footer, not a normal row', () => {
    mockHooks({
      row: reportRow(),
      data: {
        name: 'Sales Report',
        blocks: [{
          id: 'b1', type: 'table', headers: ['Name', 'Amount'], form_id: 'invoices', has_total_row: true,
          rows: [
            { cells: [{ text: 'Acme' }, { text: '100.00', num: 100 }], source_id: 'inv-1' },
            { cells: [{ text: 'Total' }, { text: '100.00', num: 100 }] },
          ],
        }],
      },
    })
    const { container } = render(<ReportMenuRuntime menu={menu('rep-1')} />)
    const footerCell = screen.getByText('Total').closest('tr')
    expect(footerCell?.parentElement?.tagName).toBe('TFOOT')
    // Exactly one "100.00" in the body, one in the footer — the total row
    // must not appear twice (once as data, once as footer).
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })
})

describe('ReportMenuRuntime — row drill-down', () => {
  it('navigates to forms/{form_id}/{source_id} when a table row with a source_id is clicked', () => {
    const onNavigate = vi.fn()
    mockHooks({
      row: reportRow(),
      data: {
        name: 'Sales Report',
        blocks: [{
          id: 'b1', type: 'table', headers: ['Name'], form_id: 'invoices',
          rows: [{ cells: [{ text: 'Acme' }], source_id: 'inv-1' }],
        }],
      },
    })
    render(<ReportMenuRuntime menu={menu('rep-1')} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('Acme').closest('tr')!)
    expect(onNavigate).toHaveBeenCalledWith('forms/invoices/inv-1')
  })

  it('does not navigate when a group-block row (no source_id) is clicked', () => {
    const onNavigate = vi.fn()
    mockHooks({
      row: reportRow(),
      data: {
        name: 'Sales Report',
        blocks: [{
          id: 'b1', type: 'group', headers: ['Region', 'Sum'],
          rows: [{ cells: [{ text: 'West' }, { text: '100', num: 100 }] }],
        }],
      },
    })
    render(<ReportMenuRuntime menu={menu('rep-1')} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('West').closest('tr')!)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

describe('ReportMenuRuntime — states', () => {
  it('shows a message when no report is selected yet', () => {
    mockHooks({ row: undefined })
    render(<ReportMenuRuntime menu={menu('')} />)
    expect(screen.getByText(/no report selected/i)).toBeTruthy()
  })

  it('shows an error message when the runtime call fails', () => {
    mockHooks({ row: reportRow(), isError: true })
    render(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.getByText(/failed to load this report/i)).toBeTruthy()
  })
})
