// RF-302's deterministic half: where a sheet's printed output starts a new
// page. Deliberately split from the (not yet built) live overlay — this
// module has NO Univer dependency and is fully unit-testable, unlike pixel
// positioning against a mounted editor.
//
// WHY "ESTIMATED" BREAKS CAN NEVER BE EXACT
// -----------------------------------------------------------------------
// workflow-engine's Chromium/Gotenberg PDF path (internal/reports/
// print_html.go) does NOT pre-compute automatic page breaks anywhere — it
// emits one long HTML <table> per sheet and lets Chromium's own print
// layout engine paginate it. The only breaks the backend knows in advance
// are AUTHOR-DECLARED ones: an explicit `row_breaks` entry (a literal CSS
// break-before) and `keep_together` atomicity (break-inside: avoid). Every
// other page boundary is an emergent property of Chromium laying out real
// text, fonts, and wrapping — ground truth this module cannot run.
//
// So `computePageBreakRows` returns manual breaks as fact and everything
// else as a PREDICTION, tagged 'estimated' rather than presented as if it
// were measured. The prediction is built on print_html.go's own row-height
// convention (printWriteRow: a row's CSS `height` is a per-spec MINIMUM,
// not a clip) treated as if it were exact — so an 'estimated' break will
// read LOW (predict a page break later than Chromium's real one) on any
// sheet where a row's actual text wraps taller than its stated height.
// This is a real, known inaccuracy, not a rounding edge case: it is why
// RF-302's own acceptance criteria ask for estimated breaks to be
// presented as estimates, not as exact boundaries.
import type { PageMargins, PageSetup, PageSize, ReportWorkbookSheet, RowHeight } from '../types'

// Mirrors internal/reports/definition.go's pageSizeMM table exactly
// (definition.go:173-177) — portrait width/height in millimeters, BEFORE
// DimensionsMM's own landscape swap. Must stay numerically identical to
// that table or a guide drifts from what Engine actually renders; an
// unset/unrecognized paper_size falls back to a4 here, matching
// DimensionsMM's own `pageSizeMM[PageSizeA4]` fallback for an unknown key.
export const PAPER_SIZE_MM: Record<Exclude<PageSize, 'custom'>, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
}

const DEFAULT_MARGIN_MM = 15

// Mirrors internal/reports/print_html.go's cssPxPerMM exactly
// (print_html.go:137) — the ONE conversion point between this module's
// mm-based page geometry and Univer's own px-based row/column sizing. CSS
// defines 1in = 96px and 1in = 25.4mm, so 1mm = 96/25.4 px.
export const CSS_PX_PER_MM = 96 / 25.4

// Mirrors internal/reports/grid.go's gridDefaultRowHeightPx (grid.go:230)
// and UniverWorkbookSurface.tsx's own `defaultRowHeight: 28` sheet config
// — the same fallback used everywhere else a row has no explicit height.
const DEFAULT_ROW_HEIGHT_PX = 28

/** Resolves page's effective portrait-neutral-then-oriented size in
 *  millimeters — mirrors workflow-engine's PageSetup.DimensionsMM
 *  (definition.go:277-292) field for field, including its landscape swap
 *  and its "unknown paper_size defaults to a4" fallback. */
export function resolvePageDimensionsMM(page: PageSetup): { width: number; height: number } {
  const dims = page.paper_size === 'custom'
    ? { width: page.custom_width_mm ?? 0, height: page.custom_height_mm ?? 0 }
    : PAPER_SIZE_MM[page.paper_size ?? 'a4'] ?? PAPER_SIZE_MM.a4
  return page.orientation === 'landscape'
    ? { width: dims.height, height: dims.width }
    : dims
}

/** Resolves page's effective margins — mirrors PageSetup.marginsMM
 *  (definition.go:297-302): an absent margins_mm defaults to 15mm on
 *  every side rather than zero. */
export function resolvePageMarginsMM(page: PageSetup): PageMargins {
  return page.margins_mm ?? {
    top_mm: DEFAULT_MARGIN_MM, right_mm: DEFAULT_MARGIN_MM, bottom_mm: DEFAULT_MARGIN_MM, left_mm: DEFAULT_MARGIN_MM,
  }
}

function rowHeightPx(rowHeights: RowHeight[] | undefined, row: number): number {
  const override = rowHeights?.find((r) => r.row === row)
  return override && override.height > 0 ? override.height : DEFAULT_ROW_HEIGHT_PX
}

export type PageBreakKind = 'manual' | 'estimated'

export interface PageBreakRow {
  /** The row a NEW page starts at — a break occurs immediately before it. */
  row: number
  kind: PageBreakKind
}

/**
 * Where sheet's printed output starts a new page under page's print
 * contract — see this module's own doc comment for why only 'manual'
 * breaks are exact and every 'estimated' one is a prediction, not a fact.
 *
 * Mirrors internal/reports/print_html.go's writePrintSheet as closely as a
 * client-side estimate can:
 *  - print.area restricts which rows count at all (rows outside it are
 *    never visited, matching writePrintSheet's rowStart/rowEnd bounds).
 *  - print.repeat_rows rows are excluded from the body flow (they render
 *    once, in a <thead> that the browser repeats on every page), so their
 *    combined height is subtracted from EVERY page's budget, not just
 *    pages after the first.
 *  - print.row_breaks forces a new page at that exact row and resets the
 *    budget — always presented as 'manual', never estimated.
 *  - print.keep_together ranges are atomic: if a range doesn't fit the
 *    CURRENT page's remaining budget, the whole range (not a partial
 *    split) moves to a fresh page, mirroring `break-inside: avoid`. A
 *    range taller than one full page is left to overflow its own page
 *    rather than looped on forever — the same outcome
 *    printKeepTogetherDiagnostics already warns about server-side.
 */
export function computePageBreakRows(
  sheet: Pick<ReportWorkbookSheet, 'row_count' | 'row_heights' | 'print'>,
  page: PageSetup,
): PageBreakRow[] {
  const print = sheet.print
  const rowStart = print?.area?.start_row ?? 0
  const rowEnd = print?.area?.end_row ?? sheet.row_count - 1
  if (rowStart > rowEnd) return []

  const { height: pageHeightMM } = resolvePageDimensionsMM(page)
  const margins = resolvePageMarginsMM(page)
  const printableHeightMM = pageHeightMM - margins.top_mm - margins.bottom_mm
  if (printableHeightMM <= 0) return []
  const printableHeightPx = printableHeightMM * CSS_PX_PER_MM

  const repeatRows = print?.repeat_rows
    ? { start: Math.max(print.repeat_rows.start, rowStart), end: Math.min(print.repeat_rows.end, rowEnd) }
    : undefined
  const isRepeatRow = (r: number) => !!repeatRows && r >= repeatRows.start && r <= repeatRows.end

  let repeatRowsHeightPx = 0
  if (repeatRows && repeatRows.start <= repeatRows.end) {
    for (let r = repeatRows.start; r <= repeatRows.end; r++) repeatRowsHeightPx += rowHeightPx(sheet.row_heights, r)
  }

  const budgetPerPage = printableHeightPx - repeatRowsHeightPx
  if (budgetPerPage <= 0) return []

  const manualBreaks = new Set(print?.row_breaks ?? [])
  const keepTogether = [...(print?.keep_together ?? [])].sort((a, b) => a.start_row - b.start_row)

  const breaks: PageBreakRow[] = []
  let remaining = budgetPerPage
  let row = rowStart

  while (row <= rowEnd) {
    if (isRepeatRow(row)) { row += 1; continue }

    // A manual break at the sheet's own first row is a no-op — the page
    // already starts there.
    if (manualBreaks.has(row) && row !== rowStart) {
      breaks.push({ row, kind: 'manual' })
      remaining = budgetPerPage
    }

    const kt = keepTogether.find((r) => r.start_row === row)
    if (kt) {
      let ktHeightPx = 0
      for (let r = kt.start_row; r <= kt.end_row; r++) {
        if (!isRepeatRow(r)) ktHeightPx += rowHeightPx(sheet.row_heights, r)
      }
      if (ktHeightPx > remaining && remaining < budgetPerPage) {
        breaks.push({ row, kind: 'estimated' })
        remaining = budgetPerPage
      }
      remaining -= ktHeightPx
      row = kt.end_row + 1
      continue
    }

    const h = rowHeightPx(sheet.row_heights, row)
    if (h > remaining && remaining < budgetPerPage) {
      breaks.push({ row, kind: 'estimated' })
      remaining = budgetPerPage
    }
    remaining -= h
    row += 1
  }

  return breaks
}
