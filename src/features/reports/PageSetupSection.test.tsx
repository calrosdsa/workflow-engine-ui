// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { PageSetupSection } from './PageSetupSection'
import type { PageSetup, ReportBlockRegion, ReportWorkbookSheet, SheetPrintSettings } from './types'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}))

// Real per-test assertions never touch this data (only the format-support
// disclosure test below reads it) — this exists so FormatSupportNote
// resolves to something rather than sitting on an unmocked, never-settling
// fetch, which every OTHER test here tolerates by simply never querying
// for what FormatSupportNote renders.
vi.mock('./api', () => ({
  metaApi: {
    rendererCapabilities: () => Promise.resolve([
      { format: 'pdf', per_cell_style: 'full', merges: 'real', images_embed: true, column_widths: true, padding: true, live_formulas: false, row_heights: 'minimum', freeze: false, page_setup: false, repeat_rows: false, page_numbering: false, watermark: false },
    ]),
  },
}))

afterEach(() => {
  cleanup()
  toastError.mockReset()
})

const sheet: ReportWorkbookSheet = { id: 's1', name: 'Sheet 1', row_count: 20, column_count: 8 }

function renderSection(opts: {
  page?: PageSetup
  sheets?: ReportWorkbookSheet[] | undefined
  getSelection?: () => ReportBlockRegion | undefined
}) {
  const onChangePage = vi.fn()
  const onChangeSheetPrint = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PageSetupSection
          page={opts.page ?? {}}
          onChangePage={onChangePage}
          sheets={'sheets' in opts ? opts.sheets : [sheet]}
          onChangeSheetPrint={onChangeSheetPrint}
          getSelection={opts.getSelection}
        />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onChangePage, onChangeSheetPrint }
}

describe('PageSetupSection — report-wide controls', () => {
  it('patches paper_size on the page setup object', () => {
    const { onChangePage } = renderSection({ page: { orientation: 'portrait' } })
    fireEvent.click(screen.getByText('A4'))
    fireEvent.click(screen.getByRole('option', { name: 'Legal' }))
    expect(onChangePage).toHaveBeenCalledWith(expect.objectContaining({ paper_size: 'legal', orientation: 'portrait' }))
  })

  it('shows custom width/height inputs, and flags them as required, only for custom paper', () => {
    renderSection({ page: { paper_size: 'a4' } })
    expect(screen.queryByText('Width (mm)')).toBeNull()

    cleanup()
    renderSection({ page: { paper_size: 'custom' } })
    expect(screen.getByText('Width (mm)')).toBeTruthy()
    expect(screen.getByText(/needs both a width and a height/)).toBeTruthy()
  })

  it('links all four margins to one value by default', () => {
    const { onChangePage } = renderSection({ page: {} })
    const topInput = screen.getByPlaceholderText('Top')
    fireEvent.change(topInput, { target: { value: '20' } })
    expect(onChangePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ margins_mm: { top_mm: 20, right_mm: 20, bottom_mm: 20, left_mm: 20 } }),
    )
  })

  it('unlinks margins so each side edits independently', () => {
    const { onChangePage } = renderSection({ page: {} })
    fireEvent.click(screen.getByText('linked'))
    fireEvent.change(screen.getByPlaceholderText('Top'), { target: { value: '30' } })
    expect(onChangePage).toHaveBeenLastCalledWith(
      expect.objectContaining({ margins_mm: { top_mm: 30, right_mm: 15, bottom_mm: 15, left_mm: 15 } }),
    )
  })

  it('rejects a margin value that would leave no room for content on the page, before it reaches the store', () => {
    // A4 is 210mm wide — linked left+right margins of 110mm each sum to
    // 220mm, exceeding it.
    const { onChangePage } = renderSection({ page: { paper_size: 'a4' } })
    fireEvent.change(screen.getByPlaceholderText('Top'), { target: { value: '110' } })
    expect(onChangePage).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('These margins leave no room for content on this paper size.')
  })

  it('warns when header/footer text contains an unrecognized token', () => {
    renderSection({ page: { header: { left: 'Hello {{bogus}}' } } })
    expect(screen.getByText(/Unrecognized token: bogus/)).toBeTruthy()
  })

  it('inserts a token into the header zone via the insert-token select', () => {
    const { onChangePage } = renderSection({ page: { header: { left: 'Page ' } } })
    fireEvent.click(screen.getAllByText('Insert…')[0])
    fireEvent.click(screen.getByRole('option', { name: 'Page number' }))
    expect(onChangePage).toHaveBeenCalledWith(
      expect.objectContaining({ header: expect.objectContaining({ left: 'Page {{page}}' }) }),
    )
  })

  it('only shows watermark color/size/opacity/angle once watermark text is set', () => {
    const { onChangePage } = renderSection({ page: {} })
    expect(screen.queryByText('Opacity (0-1)')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Watermark text (e.g. DRAFT)'), { target: { value: 'DRAFT' } })
    expect(onChangePage).toHaveBeenCalledWith(
      expect.objectContaining({ watermark: expect.objectContaining({ text: 'DRAFT' }) }),
    )
  })
})

const someSelection: ReportBlockRegion = {
  sheet_id: 's1',
  layout: { row: 2, col: 1, row_span: 3, col_span: 4 },
}

describe('PageSetupSection — print-region controls (selection-gated)', () => {
  it('refuses, with an explanatory error, when the print area is set with nothing selected', () => {
    const { onChangeSheetPrint } = renderSection({ getSelection: () => undefined })
    fireEvent.click(screen.getAllByText('Set from selection')[0])
    expect(toastError).toHaveBeenCalledWith('Select cells in the sheet first.')
    expect(onChangeSheetPrint).not.toHaveBeenCalled()
  })

  it('converts the live selection into a PrintCellRange for the print area', () => {
    const { onChangeSheetPrint } = renderSection({ getSelection: () => someSelection })
    fireEvent.click(screen.getAllByText('Set from selection')[0])
    expect(onChangeSheetPrint).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ area: { start_row: 2, end_row: 4, start_col: 1, end_col: 4 } }),
    )
  })

  it('converts the live selection into a PrintIndexRange for repeat rows', () => {
    const { onChangeSheetPrint } = renderSection({ getSelection: () => someSelection })
    fireEvent.click(screen.getAllByText('Set from selection')[1])
    expect(onChangeSheetPrint).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ repeat_rows: { start: 2, end: 4 } }),
    )
  })

  it("toggles a page break at the selection's anchor row, off when already set", () => {
    const printWithBreak: SheetPrintSettings = { row_breaks: [2] }
    const { onChangeSheetPrint } = renderSection({ sheets: [{ ...sheet, print: printWithBreak }], getSelection: () => someSelection })
    fireEvent.click(screen.getByText('Add/remove break before selected row'))
    // Row 2 was already in row_breaks, so the toggle removes it, leaving nothing set.
    expect(onChangeSheetPrint).toHaveBeenCalledWith('s1', undefined)
  })

  it('appends the selection to keep_together without duplicating an identical range', () => {
    const existing: SheetPrintSettings = { keep_together: [{ start_row: 2, end_row: 4, start_col: 1, end_col: 4 }] }
    const { onChangeSheetPrint } = renderSection({ sheets: [{ ...sheet, print: existing }], getSelection: () => someSelection })
    fireEvent.click(screen.getByText('Add selection'))
    expect(onChangeSheetPrint).not.toHaveBeenCalled()
  })

  it('shows a no-workbook message and no print-region controls when the report has no sheets', () => {
    renderSection({ sheets: undefined })
    expect(screen.getByText(/no spreadsheet layout yet/)).toBeTruthy()
    expect(screen.queryByText('Set from selection')).toBeNull()
  })
})

// Clear/Remove unmount themselves as part of their own click handler
// (the `current &&` block, or the specific <li>, they live in disappears),
// which would otherwise drop keyboard focus to document.body. These pin
// the fix: refocus the row's own always-mounted action button instead.
describe('PageSetupSection — print-region controls keep keyboard focus on unmount', () => {
  it('returns focus to "Set from selection" (print area) after Clear removes it', () => {
    const withArea: SheetPrintSettings = { area: { start_row: 0, end_row: 4, start_col: 0, end_col: 3 } }
    renderSection({ sheets: [{ ...sheet, print: withArea }], getSelection: () => someSelection })

    const setBtn = screen.getAllByText('Set from selection')[0].closest('button')!
    fireEvent.click(screen.getAllByText('Clear')[0])

    expect(document.activeElement).toBe(setBtn)
  })

  it('returns focus to "Set from selection" (repeat rows) after Clear removes it', () => {
    const withRepeat: SheetPrintSettings = { repeat_rows: { start: 0, end: 2 } }
    renderSection({ sheets: [{ ...sheet, print: withRepeat }], getSelection: () => someSelection })

    const setBtn = screen.getAllByText('Set from selection')[1].closest('button')!
    fireEvent.click(screen.getAllByText('Clear')[0])

    expect(document.activeElement).toBe(setBtn)
  })

  it('returns focus to "Add selection" after Remove deletes a keep-together range', () => {
    const existing: SheetPrintSettings = { keep_together: [{ start_row: 2, end_row: 4, start_col: 1, end_col: 4 }] }
    renderSection({ sheets: [{ ...sheet, print: existing }], getSelection: () => someSelection })

    const addBtn = screen.getByText('Add selection').closest('button')!
    fireEvent.click(screen.getByText('Remove'))

    expect(document.activeElement).toBe(addBtn)
  })

  it('exposes the format-support disclosure as expandable to assistive tech', async () => {
    renderSection({ page: {} })
    const toggle = await screen.findByText('Which formats support these features?')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })
})
