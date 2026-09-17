import { describe, expect, it } from 'vitest'
import { computePageBreakRows, resolvePageDimensionsMM, resolvePageMarginsMM } from './page-breaks'
import type { PageSetup, ReportWorkbookSheet } from '../types'

describe('resolvePageDimensionsMM', () => {
  it('defaults to A4 portrait when paper_size is unset', () => {
    expect(resolvePageDimensionsMM({})).toEqual({ width: 210, height: 297 })
  })

  it('swaps width/height for landscape', () => {
    expect(resolvePageDimensionsMM({ paper_size: 'letter', orientation: 'landscape' }))
      .toEqual({ width: 279.4, height: 215.9 })
  })

  it('uses custom_width_mm/custom_height_mm for a custom paper size, swapped for landscape too', () => {
    expect(resolvePageDimensionsMM({ paper_size: 'custom', custom_width_mm: 300, custom_height_mm: 400 }))
      .toEqual({ width: 300, height: 400 })
    expect(resolvePageDimensionsMM({ paper_size: 'custom', custom_width_mm: 300, custom_height_mm: 400, orientation: 'landscape' }))
      .toEqual({ width: 400, height: 300 })
  })
})

describe('resolvePageMarginsMM', () => {
  it('defaults every side to 15mm when margins_mm is absent', () => {
    expect(resolvePageMarginsMM({})).toEqual({ top_mm: 15, right_mm: 15, bottom_mm: 15, left_mm: 15 })
  })

  it('passes through an explicit margins_mm unchanged', () => {
    const margins = { top_mm: 5, right_mm: 6, bottom_mm: 7, left_mm: 8 }
    expect(resolvePageMarginsMM({ margins_mm: margins })).toEqual(margins)
  })
})

// Every computePageBreakRows test below uses a custom page sized so
// printableHeightPx works out to an EXACT multiple of the 28px default row
// height (84px = 3 rows), so expected break rows are exact integers rather
// than floating-point-sensitive guesses. custom_height_mm=22.225 is chosen
// because 22.225 * 96/25.4 = 84.0 exactly (22.225mm * cssPxPerMM = 84px).
const THREE_ROWS_PAGE: PageSetup = {
  paper_size: 'custom',
  custom_width_mm: 100,
  custom_height_mm: 22.225,
  margins_mm: { top_mm: 0, right_mm: 0, bottom_mm: 0, left_mm: 0 },
}

function sheet(overrides: Partial<ReportWorkbookSheet> = {}): Pick<ReportWorkbookSheet, 'row_count' | 'row_heights' | 'print'> {
  return { row_count: 9, row_heights: undefined, print: undefined, ...overrides }
}

describe('computePageBreakRows — automatic breaks (no print settings)', () => {
  it('estimates a break every 3 rows (84px page / 28px default row height)', () => {
    expect(computePageBreakRows(sheet({ row_count: 9 }), THREE_ROWS_PAGE)).toEqual([
      { row: 3, kind: 'estimated' },
      { row: 6, kind: 'estimated' },
    ])
  })

  it('returns nothing for a sheet that fits on one page', () => {
    expect(computePageBreakRows(sheet({ row_count: 3 }), THREE_ROWS_PAGE)).toEqual([])
  })

  it('honors explicit row_heights over the 28px default', () => {
    // Row 0 is 84px tall by itself — fills the whole first page alone.
    const s = sheet({ row_count: 4, row_heights: [{ row: 0, height: 84 }] })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([{ row: 1, kind: 'estimated' }])
  })
})

describe('computePageBreakRows — manual row_breaks', () => {
  it('reports a manual break as fact and resets the page budget there, shifting later estimated breaks', () => {
    const s = sheet({ row_count: 9, print: { row_breaks: [2] } })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([
      { row: 2, kind: 'manual' },
      { row: 5, kind: 'estimated' },
      { row: 8, kind: 'estimated' },
    ])
  })

  it('is a no-op at the sheet/area\'s own first row — a page already starts there', () => {
    const s = sheet({ row_count: 9, print: { row_breaks: [0] } })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([
      { row: 3, kind: 'estimated' },
      { row: 6, kind: 'estimated' },
    ])
  })
})

describe('computePageBreakRows — keep_together', () => {
  it('bumps a range that would otherwise split across a page boundary to a fresh page, whole', () => {
    // Rows 2-4 (84px) do not fit the 28px remaining on page 1 after rows
    // 0-1, so the whole range moves to page 2 rather than splitting.
    const s = sheet({ row_count: 6, print: { keep_together: [{ start_row: 2, end_row: 4, start_col: 0, end_col: 0 }] } })
    const breaks = computePageBreakRows(s, THREE_ROWS_PAGE)
    expect(breaks).toEqual([
      { row: 2, kind: 'estimated' },
      { row: 5, kind: 'estimated' },
    ])
    // No break lands INSIDE the range (row 3 or row 4) — it is atomic.
    expect(breaks.some((b) => b.row === 3 || b.row === 4)).toBe(false)
  })

  it('does not force an early break when the range already fits the remaining budget', () => {
    const s = sheet({ row_count: 6, print: { keep_together: [{ start_row: 0, end_row: 2, start_col: 0, end_col: 0 }] } })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([{ row: 3, kind: 'estimated' }])
  })

  it('lets a range taller than one full page overflow its own page instead of looping forever', () => {
    const s = sheet({
      row_count: 6,
      row_heights: [{ row: 0, height: 200 }, { row: 1, height: 200 }],
      print: { keep_together: [{ start_row: 0, end_row: 1, start_col: 0, end_col: 0 }] },
    })
    const breaks = computePageBreakRows(s, THREE_ROWS_PAGE)
    // Terminates, and the next content after the oversized range still
    // gets its own break rather than being silently swallowed.
    expect(breaks.length).toBeGreaterThan(0)
    expect(breaks[0]).toEqual({ row: 2, kind: 'estimated' })
  })
})

describe('computePageBreakRows — repeat_rows', () => {
  it('subtracts the repeated header\'s height from EVERY page\'s budget, not just later pages', () => {
    // Row 0 is a 28px repeat-row header, leaving 56px (2 rows) per page for
    // the remaining body rows 1-6 — down from 3 rows/page without it.
    const s = sheet({ row_count: 7, print: { repeat_rows: { start: 0, end: 0 } } })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([
      { row: 3, kind: 'estimated' },
      { row: 5, kind: 'estimated' },
    ])
  })

  it('never emits a break at a row inside the repeat-rows band', () => {
    const s = sheet({ row_count: 7, print: { repeat_rows: { start: 0, end: 0 } } })
    const breaks = computePageBreakRows(s, THREE_ROWS_PAGE)
    expect(breaks.some((b) => b.row === 0)).toBe(false)
  })
})

describe('computePageBreakRows — print.area', () => {
  it('only walks rows inside the print area, reporting absolute row indices unshifted', () => {
    const s = sheet({ row_count: 10, print: { area: { start_row: 2, end_row: 5, start_col: 0, end_col: 0 } } })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([{ row: 5, kind: 'estimated' }])
  })
})

describe('computePageBreakRows — degenerate inputs never throw', () => {
  it('returns [] for an empty/inverted area', () => {
    const s = sheet({ row_count: 10, print: { area: { start_row: 5, end_row: 2, start_col: 0, end_col: 0 } } })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([])
  })

  it('returns [] when margins consume the whole page (no printable height)', () => {
    const page: PageSetup = {
      paper_size: 'custom', custom_width_mm: 100, custom_height_mm: 20,
      margins_mm: { top_mm: 15, right_mm: 0, bottom_mm: 15, left_mm: 0 },
    }
    expect(computePageBreakRows(sheet({ row_count: 5 }), page)).toEqual([])
  })

  it('returns [] when the repeat-rows band alone consumes the whole printable page', () => {
    // 90px, not 84px — clearly over budget rather than exactly equal to it,
    // so this doesn't depend on 22.225mm's floating-point round trip
    // landing on exactly 84.0px.
    const s = sheet({
      row_count: 5,
      row_heights: [{ row: 0, height: 90 }],
      print: { repeat_rows: { start: 0, end: 0 } },
    })
    expect(computePageBreakRows(s, THREE_ROWS_PAGE)).toEqual([])
  })
})
