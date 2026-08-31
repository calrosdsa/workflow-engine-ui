import {
  BooleanNumber,
  HorizontalAlign,
  VerticalAlign,
  WrapStrategy,
  type ICellData,
  type IStyleData,
  type IWorkbookData,
  type IWorksheetData,
} from '@univerjs/presets'
import type { BlockStyle, ReportBlock, ReportDefinition } from '../types'
import { projectRegionCells, sourceLookup, type FormLookup, type ProjectedRegionCell } from './region-projection'

export const REPORT_REGION_GUIDE_KEY = 'report_builder_region'

// Workbook guides are editor-only cells marking a semantic report region.
// Their custom marker lets the contract adapter discard them at save time,
// preventing a table/query/image block from becoming static sheet content.
export function reportRegionGuide(blockID: string): Pick<ICellData, 'custom'> {
  return { custom: { [REPORT_REGION_GUIDE_KEY]: blockID } }
}

export function isReportRegionGuide(cell: ICellData | undefined): boolean {
  return typeof cell?.custom?.[REPORT_REGION_GUIDE_KEY] === 'string'
}

/** Converts a report BlockStyle into the Univer cell style used to draw a
 *  region guide, so an author sees the same bold/fill/alignment the export
 *  will apply rather than a generic placeholder treatment. */
export function blockStyleToUniverStyle(style?: BlockStyle): IStyleData {
  const base: IStyleData = {
    ff: 'Inter',
    fs: 11,
    vt: VerticalAlign.MIDDLE,
    tb: WrapStrategy.WRAP,
  }
  if (!style) return base

  const alignments: Record<NonNullable<BlockStyle['align']>, HorizontalAlign> = {
    left: HorizontalAlign.LEFT,
    center: HorizontalAlign.CENTER,
    right: HorizontalAlign.RIGHT,
  }
  const border = style.border && style.border.width && style.border.width > 0
    ? { s: 1, cl: { rgb: style.border.color || '#000000' } }
    : undefined

  return {
    ...base,
    bl: style.bold === undefined ? undefined : style.bold ? BooleanNumber.TRUE : BooleanNumber.FALSE,
    it: style.italic === undefined ? undefined : style.italic ? BooleanNumber.TRUE : BooleanNumber.FALSE,
    ht: style.align ? alignments[style.align] : undefined,
    bg: style.fill_color ? { rgb: style.fill_color } : undefined,
    cl: style.text_color ? { rgb: style.text_color } : undefined,
    pd: style.padding
      ? { t: style.padding.top, r: style.padding.right, b: style.padding.bottom, l: style.padding.left }
      : undefined,
    ...(border ? { bd: { t: border, r: border, b: border, l: border } } : {}),
  }
}

/**
 * Draws every block's semantic region onto the editor grid.
 *
 * A configured tabular block is drawn as a real table — one cell per column
 * header in its header style, plus placeholder body rows in its body style —
 * rather than a single merged placeholder, so the author can see and format
 * the actual shape the export will produce. Author-owned static cells always
 * win a collision: the semantic region still exports correctly, it simply
 * yields its guide at that coordinate.
 */
export function withReportRegionGuides(
  workbook: Partial<IWorkbookData>,
  definition: Pick<ReportDefinition, 'blocks' | 'settings' | 'data_sources'>,
  forms: FormLookup = new Map(),
): Partial<IWorkbookData> {
  const sheets = cloneSheets(workbook.sheets ?? {})
  const sheetOrder = workbook.sheetOrder ?? Object.keys(sheets)
  const defaultSheetID = sheetOrder[0]
  const styleDefaults = definition.settings?.style_defaults
  const sources = sourceLookup(definition)

  definition.blocks.forEach((block) => {
    const sheetID = block.sheet_id || defaultSheetID
    const sheet = sheetID ? sheets[sheetID] : undefined
    if (!sheet) return
    addRegionGuide(sheet, block, projectRegionCells(block, forms, styleDefaults, sources))
  })

  return { ...workbook, sheets }
}

function cloneSheets(sheets: IWorkbookData['sheets']): IWorkbookData['sheets'] {
  return Object.fromEntries(Object.entries(sheets).map(([id, sheet]) => [
    id,
    {
      ...sheet,
      cellData: Object.fromEntries(Object.entries(sheet.cellData ?? {}).map(([row, cells]) => [row, { ...cells }])),
      mergeData: [...(sheet.mergeData ?? [])],
    },
  ])) as IWorkbookData['sheets']
}

function addRegionGuide(sheet: Partial<IWorksheetData>, block: ReportBlock, projected: ProjectedRegionCell[]): void {
  const cellData = sheet.cellData ?? (sheet.cellData = {})

  projected.forEach((cell) => {
    const rowData = cellData[cell.row] ?? (cellData[cell.row] = {})
    // A user-owned static cell wins any collision.
    if (rowData[cell.col] !== undefined) return
    rowData[cell.col] = {
      v: cell.value,
      s: blockStyleToUniverStyle(cell.style),
      ...reportRegionGuide(block.id),
    }
  })

  // Only a single-cell region (text, image, or a not-yet-configured data
  // block) merges across its authored span. A real table must stay
  // per-column, so merging it would destroy the grid it just drew.
  if (projected.length !== 1) return

  const anchor = projected[0]
  const rowSpan = Math.max(1, block.layout.row_span || 1)
  const columnSpan = Math.max(1, block.layout.col_span || 1)
  if (rowSpan === 1 && columnSpan === 1) return

  const guideRange = {
    startRow: anchor.row,
    endRow: anchor.row + rowSpan - 1,
    startColumn: anchor.col,
    endColumn: anchor.col + columnSpan - 1,
  }
  const merges = sheet.mergeData ?? (sheet.mergeData = [])
  if (
    !hasCellOtherThanAnchor(cellData, guideRange, anchor.row, anchor.col)
    && !merges.some((merge) => rangesOverlap(merge, guideRange))
  ) {
    merges.push(guideRange)
  }
}

function hasCellOtherThanAnchor(
  cellData: NonNullable<IWorksheetData['cellData']>,
  range: { startRow: number; endRow: number; startColumn: number; endColumn: number },
  anchorRow: number,
  anchorColumn: number,
): boolean {
  return Object.entries(cellData).some(([rowKey, cells]) => {
    const row = Number(rowKey)
    if (row < range.startRow || row > range.endRow) return false
    return Object.keys(cells ?? {}).some((columnKey) => {
      const column = Number(columnKey)
      return column >= range.startColumn
        && column <= range.endColumn
        && (row !== anchorRow || column !== anchorColumn)
    })
  })
}

function rangesOverlap(
  left: { startRow: number; endRow: number; startColumn: number; endColumn: number },
  right: { startRow: number; endRow: number; startColumn: number; endColumn: number },
): boolean {
  return left.startRow <= right.endRow
    && left.endRow >= right.startRow
    && left.startColumn <= right.endColumn
    && left.endColumn >= right.startColumn
}
