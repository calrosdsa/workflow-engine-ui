import type { ReportDefinition } from '../types'
import { projectRegionCells, sourceLookup, type FormLookup } from './region-projection'

export interface ReportWorkbookBlueprint {
  name: string
  rowCount: number
  columnCount: number
}

const MINIMUM_ROWS = 36
const MINIMUM_COLUMNS = 12
const ROW_HEADROOM = 6
const COLUMN_HEADROOM = 3

// Sizes the editor grid for a report that has no saved workbook yet. Drawing
// the regions themselves belongs to guides.ts, which is the single place a
// semantic region becomes cells; this only has to guarantee the sheet is big
// enough that every projected region — including a table's header row and its
// placeholder body rows — is actually reachable on the grid.
export function createReportWorkbookBlueprint(
  definition: ReportDefinition,
  forms: FormLookup = new Map(),
): ReportWorkbookBlueprint {
  const styleDefaults = definition.settings?.style_defaults
  const sources = sourceLookup(definition)
  let maxRow = 0
  let maxColumn = 0

  definition.blocks.forEach((block) => {
    const projected = projectRegionCells(block, forms, styleDefaults, sources)
    // A region occupies at least its authored span, and at least as much as
    // its projection actually draws — a table's drawn height regularly
    // exceeds a span authored before its columns were known.
    const spanRow = Math.max(0, block.layout.row) + Math.max(1, block.layout.row_span || 1)
    const spanColumn = Math.max(0, block.layout.col) + Math.max(1, block.layout.col_span || 1)
    maxRow = Math.max(maxRow, spanRow)
    maxColumn = Math.max(maxColumn, spanColumn)

    projected.forEach((cell) => {
      maxRow = Math.max(maxRow, cell.row + 1)
      maxColumn = Math.max(maxColumn, cell.col + 1)
    })
  })

  return {
    name: definition.name || 'Untitled report',
    rowCount: Math.max(MINIMUM_ROWS, maxRow + ROW_HEADROOM),
    columnCount: Math.max(MINIMUM_COLUMNS, maxColumn + COLUMN_HEADROOM),
  }
}
