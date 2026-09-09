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
import type { ReactElement } from 'react'
import { ReportMenuRuntime } from './ReportMenuRuntime'
import { useReport, useRuntimeReport, useExportReport } from '@/features/reports/hooks'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { emptyReportDefinition } from '@/features/reports/types'
import type { ReportDefinitionRow, ReportArgument, ReportSettings } from '@/features/reports/types'
import type { RuntimeReportResult } from '@/features/reports/api'
import type { Menu, ReportMenuConfig } from '../types'

// The pager added to ReportTableBlockView calls useTranslation, which
// throws outside an I18nProvider ancestor — real provider, no props, so
// this exercises the actual en.ts strings rather than a mocked t().
function renderMenu(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

afterEach(cleanup)

// Radix Select (the download format picker) leans on browser APIs jsdom
// doesn't implement — same stub set combobox-aria.test.tsx already
// established for exactly this Radix-in-jsdom gap.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

vi.mock('@/features/reports/hooks', () => ({
  useReport: vi.fn(),
  useRuntimeReport: vi.fn(),
  useExportReport: vi.fn(),
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

function reportRow(over: { arguments?: ReportArgument[]; settings?: ReportSettings } = {}): ReportDefinitionRow {
  return {
    id: 'rep-1',
    name: 'Sales Report',
    definition: {
      ...emptyReportDefinition('Sales Report'),
      arguments: over.arguments,
      settings: over.settings ?? {},
    },
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
  exportMutate?: (args?: unknown) => void
  exportPending?: boolean
}) {
  vi.mocked(useReport).mockReturnValue({
    data: over.row, isLoading: over.loading ?? false,
  } as ReturnType<typeof useReport>)
  vi.mocked(useRuntimeReport).mockReturnValue({
    data: over.data, isPending: over.isPending ?? false, isError: over.isError ?? false, error: null,
    mutate: over.mutate ?? vi.fn(), mutateAsync: vi.fn(), reset: vi.fn(),
  } as unknown as ReturnType<typeof useRuntimeReport>)
  vi.mocked(useExportReport).mockReturnValue({
    isPending: over.exportPending ?? false, isError: false, error: null,
    mutate: over.exportMutate ?? vi.fn(), mutateAsync: vi.fn(), reset: vi.fn(),
  } as unknown as ReturnType<typeof useExportReport>)
}

describe('ReportMenuRuntime — auto-run', () => {
  it('auto-runs (calls mutate) on mount when the report has no arguments to prompt for', () => {
    const mutate = vi.fn()
    mockHooks({ row: reportRow(), mutate })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('does NOT auto-run when a required argument has no default — shows the filter bar instead', () => {
    const mutate = vi.fn()
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text', required: true }]
    mockHooks({ row: reportRow({ arguments: argumentList }), mutate })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('Region')).toBeTruthy()
    expect(screen.getByRole('button', { name: /run/i })).toBeTruthy()
  })

  it('Run button is disabled while a required argument is unfilled, and calls mutate once filled', () => {
    const mutate = vi.fn()
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text', required: true }]
    mockHooks({ row: reportRow({ arguments: argumentList }), mutate })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

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
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.getByText('Q3 summary')).toBeTruthy()
  })

  it('renders an image block', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'Sales Report', blocks: [{ id: 'b1', type: 'image', image: { link_url: 'https://example.test/x.png', alt: 'Logo' } }] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
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
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
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
    const { container } = renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
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
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} onNavigate={onNavigate} />)

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
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByText('West').closest('tr')!)
    expect(onNavigate).not.toHaveBeenCalled()
  })
})

describe('ReportMenuRuntime — download', () => {
  it('shows a Download button once the report loads, with no format picker when allowed_formats has 0 or 1 entries', () => {
    mockHooks({ row: reportRow({ settings: { default_format: 'pdf' } }) })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.getByRole('button', { name: /download/i })).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('downloads using settings.default_format alone when allowed_formats has 0 or 1 entries', () => {
    const exportMutate = vi.fn()
    mockHooks({
      row: reportRow({ settings: { default_format: 'csv', allowed_formats: ['csv'] } }),
      exportMutate,
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByRole('button', { name: /download/i }))
    expect(exportMutate).toHaveBeenCalledWith({ format: 'csv', argumentValues: {} }, expect.anything())
  })

  it('shows a format picker when allowed_formats has more than one entry, and downloads whichever is picked', async () => {
    const exportMutate = vi.fn()
    mockHooks({
      row: reportRow({ settings: { default_format: 'pdf', allowed_formats: ['pdf', 'csv'] } }),
      exportMutate,
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('CSV'))
    fireEvent.click(screen.getByRole('button', { name: /download/i }))

    expect(exportMutate).toHaveBeenCalledWith({ format: 'csv', argumentValues: {} }, expect.anything())
  })

  it('disables Download while a required argument is unfilled, submitting the on-screen values once filled', () => {
    const exportMutate = vi.fn()
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text', required: true }]
    mockHooks({
      row: reportRow({ arguments: argumentList, settings: { default_format: 'pdf' } }),
      exportMutate,
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    const downloadButton = screen.getByRole('button', { name: /download/i }) as HTMLButtonElement
    expect(downloadButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'West' } })
    expect(downloadButton.disabled).toBe(false)
    fireEvent.click(downloadButton)
    expect(exportMutate).toHaveBeenCalledWith({ format: 'pdf', argumentValues: { region: 'West' } }, expect.anything())
  })
})

describe('ReportMenuRuntime — states', () => {
  it('shows a message when no report is selected yet', () => {
    mockHooks({ row: undefined })
    renderMenu(<ReportMenuRuntime menu={menu('')} />)
    expect(screen.getByText(/no report selected/i)).toBeTruthy()
  })

  it('shows an error message when the runtime call fails', () => {
    mockHooks({ row: reportRow(), isError: true })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.getByText(/failed to load this report/i)).toBeTruthy()
  })
})

// A helper for the sort/paging suite: rows are given as [text, num] pairs so
// a test can freely mismatch a cell's SORT value from its DISPLAY text —
// exactly the shape a currency-formatted column has in real reports, and
// the shape the bug being fixed here failed on.
function amountBlock(overrides: Partial<{ headers: string[]; rows: Array<[string, number | undefined]> }> = {}) {
  const headers = overrides.headers ?? ['Name', 'Amount']
  const rows = (overrides.rows ?? []).map(([text, num], i) => ({
    cells: [{ text: `Row ${i}` }, { text, num }],
  }))
  return { id: 'b1', type: 'table' as const, headers, rows }
}

describe('ReportMenuRuntime — table sort', () => {
  // THE bug this whole change exists to fix: rowToRecord kept only
  // cell.text, so a server-formatted currency column ("$999.00" <
  // "$1,200.00" lexically) sorted as text instead of by cell.num.
  it('sorts a numeric column by cell.num, not by its formatted display text', () => {
    mockHooks({
      row: reportRow(),
      data: {
        name: 'R',
        blocks: [amountBlock({ rows: [['$999.00', 999], ['$1,200.00', 1200], ['$50.00', 50]] })],
      },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByText('Amount'))
    const cellsInOrder = screen.getAllByText(/^\$/).map((el) => el.textContent)
    expect(cellsInOrder).toEqual(['$50.00', '$999.00', '$1,200.00'])
  })

  it('reverses to descending on a second click of the same header', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'R', blocks: [amountBlock({ rows: [['$1.00', 1], ['$3.00', 3], ['$2.00', 2]] })] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    const header = screen.getByText('Amount')
    fireEvent.click(header)
    fireEvent.click(header)
    const cellsInOrder = screen.getAllByText(/^\$/).map((el) => el.textContent)
    expect(cellsInOrder).toEqual(['$3.00', '$2.00', '$1.00'])
  })

  // Falls back to the display text when a row has no num at all (a plain
  // text column, or group-by label) — still a real, if lexical, sort.
  it('falls back to text comparison for a column with no numeric cells', () => {
    mockHooks({
      row: reportRow(),
      data: {
        name: 'R',
        blocks: [{
          id: 'b1', type: 'group', headers: ['Region'],
          rows: [{ cells: [{ text: 'West' }] }, { cells: [{ text: 'East' }] }, { cells: [{ text: 'North' }] }],
        }],
      },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByText('Region'))
    const rows = screen.getAllByRole('row').slice(1) // drop the header row
    expect(rows.map((r) => r.textContent)).toEqual(['East', 'North', 'West'])
  })

  // Loading a report must NOT silently re-sort it — a table/group block's
  // row order already reflects whatever sort_by/sort_dir the report's
  // author configured server-side.
  it('renders in server order until a header is actually clicked', () => {
    mockHooks({
      row: reportRow(),
      data: {
        name: 'R',
        blocks: [amountBlock({ rows: [['$1,200.00', 1200], ['$50.00', 50], ['$999.00', 999]] })],
      },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    const cellsInOrder = screen.getAllByText(/^\$/).map((el) => el.textContent)
    expect(cellsInOrder).toEqual(['$1,200.00', '$50.00', '$999.00'])
  })

  // The total row is a summary, not a data point — sorting must never move
  // it out of the DataTable footer and into the sortable body.
  it('leaves the total row out of the sort entirely', () => {
    mockHooks({
      row: reportRow(),
      data: {
        name: 'R',
        blocks: [{
          id: 'b1', type: 'table', headers: ['Name', 'Amount'], has_total_row: true,
          rows: [
            { cells: [{ text: 'B' }, { text: '$1.00', num: 1 }] },
            { cells: [{ text: 'A' }, { text: '$2.00', num: 2 }] },
            { cells: [{ text: 'Total' }, { text: '$3.00', num: 3 }] },
          ],
        }],
      },
    })
    const { container } = renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    fireEvent.click(screen.getByText('Amount'))

    const footerRow = screen.getByText('Total').closest('tr')
    expect(footerRow?.parentElement?.tagName).toBe('TFOOT')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })
})

describe('ReportMenuRuntime — paging', () => {
  // The Amount text is deliberately distinct from the auto-generated "Row
  // {i}" Name text (amountBlock's own doc comment) — reusing the same
  // string in both columns made every row match its own assertion twice
  // (once per column) and throw a "multiple elements" error that had
  // nothing to do with paging or sorting.
  function manyRows(count: number) {
    return Array.from({ length: count }, (_, i) => [`$${i}.00`, i] as [string, number])
  }

  it('shows no pager for a block within one page', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'R', blocks: [amountBlock({ rows: manyRows(10) })] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    expect(screen.queryByText(/rows$/)).toBeNull()
  })

  it('shows a pager and only the first page of rows once a block exceeds the default page size', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'R', blocks: [amountBlock({ rows: manyRows(150) })] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    // 100 is the default page size — the ONLY reason it's asserted as a
    // literal here rather than imported is that it isn't exported; if that
    // changes, DEFAULT_PAGE_SIZE should be exported and this should import it.
    expect(screen.getByText('Row 0')).toBeTruthy()
    expect(screen.getByText('Row 99')).toBeTruthy()
    expect(screen.queryByText('Row 100')).toBeNull()
    expect(screen.getByText('150 rows')).toBeTruthy()
  })

  it('advances to the next page and shows its rows', () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'R', blocks: [amountBlock({ rows: manyRows(150) })] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('Row 100')).toBeTruthy()
    expect(screen.queryByText('Row 0')).toBeNull()
  })

  // Sorting reorders across the WHOLE dataset, then pages the result — not
  // "sort within whatever happens to be on the current page".
  it('sorts across the full row set, not just the current page', () => {
    // Row 0 holds the largest amount, so an ascending sort must pull it to
    // the very end — page 1 of an ascending sort should NOT show Row 0.
    const rows: Array<[string, number]> = manyRows(150).map(([text], i) => [text, 150 - i])
    mockHooks({
      row: reportRow(),
      data: { name: 'R', blocks: [amountBlock({ rows })] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByText('Amount'))
    expect(screen.queryByText('Row 0')).toBeNull()
    expect(screen.getByText('Row 149')).toBeTruthy()
  })

  it('resets to page 1 when the underlying data changes (e.g. Refresh with new arguments)', () => {
    // The real scenario: ReportMenuRuntime stays mounted across a Refresh —
    // it's the query hook's data that changes, not the component identity —
    // so this uses rerender on the SAME tree rather than a second render(),
    // which would otherwise leave two trees mounted at once.
    const argumentList = [{ key: 'region', label: 'Region', type: 'text' as const, required: true }]
    const mutate = vi.fn()
    mockHooks({
      row: reportRow({ arguments: argumentList }),
      data: { name: 'R', blocks: [amountBlock({ rows: manyRows(150) })] },
      mutate,
    })
    const { rerender } = renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('Row 100')).toBeTruthy()

    // Simulate the refreshed response landing with far fewer rows — a NEW
    // array reference, same block id, the exact shape a real refetch takes.
    mockHooks({
      row: reportRow({ arguments: argumentList }),
      data: { name: 'R', blocks: [amountBlock({ rows: manyRows(5) })] },
      mutate,
    })
    rerender(<I18nProvider><ReportMenuRuntime menu={menu('rep-1')} /></I18nProvider>)
    expect(screen.getByText('Row 0')).toBeTruthy()
  })

  it('changing the page size resets to page 1', async () => {
    mockHooks({
      row: reportRow(),
      data: { name: 'R', blocks: [amountBlock({ rows: manyRows(150) })] },
    })
    renderMenu(<ReportMenuRuntime menu={menu('rep-1')} />)

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('Row 100')).toBeTruthy()

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('50 / page'))
    expect(screen.getByText('Row 0')).toBeTruthy()
  })
})
