import type {
  ICellData,
  IStyleData,
  IWorkbookData,
  IWorksheetData,
} from '@univerjs/presets'
import type {
  ColumnWidth,
  ReportWorkbook,
  ReportWorkbookSheet,
  WorkbookCell,
  WorkbookCellStyle,
  WorkbookCellValue,
} from '../types'
import { isReportRegionGuide } from './guides'

type WorkbookSnapshot = Pick<IWorkbookData, 'id' | 'name' | 'sheetOrder' | 'sheets' | 'styles'>

const BOOLEAN_FALSE = 0
const BOOLEAN_TRUE = 1
const HORIZONTAL_ALIGNMENTS = { left: 1, center: 2, right: 3 } as const
const VERTICAL_ALIGNMENTS = { top: 1, middle: 2, bottom: 3 } as const
const WRAP = 3

// Converts the editor's current workbook into the app-owned v2 report
// contract. This is intentionally a whitelist: collaboration metadata,
// plugin resources and editor implementation details never enter a report
// definition, while ordinary cell values, formulas, merges and styles do.
export function fromUniverWorkbook(snapshot: WorkbookSnapshot): ReportWorkbook {
  const sheetIDs = snapshot.sheetOrder?.filter((id) => snapshot.sheets[id] !== undefined)
    ?? Object.keys(snapshot.sheets)

  return {
    sheets: sheetIDs.map((sheetID) => fromUniverSheet(sheetID, snapshot.sheets[sheetID] ?? {}, snapshot.styles)),
  }
}

// Converts the portable report contract back into the minimal Univer data
// the editor needs. Keeping this inverse beside fromUniverWorkbook makes
// the dependency boundary inspectable and prevents a raw editor snapshot
// from becoming the persisted report format by accident.
export function toUniverWorkbook(name: string, workbook: ReportWorkbook): Partial<IWorkbookData> {
  const sheets: IWorkbookData['sheets'] = {}
  const sheetOrder: string[] = []

  workbook.sheets.forEach((sheet) => {
    sheetOrder.push(sheet.id)
    const cellData: Record<number, Record<number, ICellData>> = {}
    sheet.cells?.forEach((cell) => {
      cellData[cell.row] ??= {}
      cellData[cell.row][cell.col] = {
        ...(cell.formula ? { f: cell.formula } : cell.value !== undefined ? { v: cell.value } : {}),
        ...(cell.style ? { s: toUniverStyle(cell.style) } : {}),
      }
    })

    const columnData: Record<number, { w: number }> = {}
    sheet.column_widths?.forEach((cw) => {
      columnData[cw.col] = { w: cw.width }
    })

    sheets[sheet.id] = {
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.row_count,
      columnCount: sheet.column_count,
      // 112 is this editor's own unresized-column default — a column with
      // no entry in columnData renders at this width, and a column the
      // author never touched stays this way on save too (fromUniverSheet
      // below only records a column when Univer's own columnData has an
      // entry for it).
      defaultColumnWidth: 112,
      defaultRowHeight: 28,
      freeze: { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 },
      cellData,
      mergeData: sheet.merges?.map((merge) => ({
        startRow: merge.start_row,
        endRow: merge.end_row,
        startColumn: merge.start_col,
        endColumn: merge.end_col,
      })) ?? [],
      ...(Object.keys(columnData).length > 0 ? { columnData } : {}),
      showGridlines: BOOLEAN_TRUE,
      rowHeader: { width: 46 },
      columnHeader: { height: 30 },
    }
  })

  return {
    id: 'report-builder-workbook',
    name,
    sheetOrder,
    sheets,
  }
}

function fromUniverSheet(
  fallbackID: string,
  sheet: Partial<IWorksheetData>,
  styles: IWorkbookData['styles'],
): ReportWorkbookSheet {
  const cells: WorkbookCell[] = []
  const cellData = sheet.cellData ?? {}

  Object.entries(cellData).forEach(([rowKey, row]) => {
    Object.entries(row ?? {}).forEach(([columnKey, rawCell]) => {
      const cell = rawCell as ICellData
      if (isReportRegionGuide(cell)) return
      const value = isWorkbookCellValue(cell.v) ? cell.v : undefined
      const style = fromUniverStyle(resolveStyle(cell.s, styles))
      if (value === undefined && !cell.f && !style) return

      cells.push({
        row: Number(rowKey),
        col: Number(columnKey),
        ...(cell.f ? { formula: cell.f } : value !== undefined ? { value } : {}),
        ...(style ? { style } : {}),
      })
    })
  })

  cells.sort((a, b) => a.row - b.row || a.col - b.col)

  const columnCount = sheet.columnCount ?? 12
  const columnWidths: ColumnWidth[] = Object.entries(sheet.columnData ?? {})
    .map(([colKey, col]) => ({ col: Number(colKey), width: col?.w }))
    // A column the author never dragged has no entry at all (Univer only
    // records columnData for a column once it's touched), and a hidden or
    // otherwise-flagged column can carry a columnData entry with no `w` —
    // both cases are "still the editor's own default", not a real width to
    // persist. Also drop anything outside the sheet's own column_count so a
    // definition never reaches the backend's stricter bounds validation
    // (definition.go) with an out-of-range entry.
    .filter((cw): cw is ColumnWidth => typeof cw.width === 'number' && cw.width > 0 && cw.col >= 0 && cw.col < columnCount)
    .sort((a, b) => a.col - b.col)

  return {
    id: sheet.id ?? fallbackID,
    name: sheet.name ?? fallbackID,
    row_count: sheet.rowCount ?? 36,
    column_count: columnCount,
    ...(cells.length > 0 ? { cells } : {}),
    ...(sheet.mergeData && sheet.mergeData.length > 0
      ? {
          merges: sheet.mergeData
            .filter((merge) => !isReportRegionGuide(cellData[merge.startRow]?.[merge.startColumn] as ICellData | undefined))
            .map((merge) => ({
              start_row: merge.startRow,
              end_row: merge.endRow,
              start_col: merge.startColumn,
              end_col: merge.endColumn,
            })),
        }
      : {}),
    ...(columnWidths.length > 0 ? { column_widths: columnWidths } : {}),
  }
}

function isWorkbookCellValue(value: ICellData['v']): value is WorkbookCellValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function resolveStyle(style: ICellData['s'], styles: IWorkbookData['styles']): IStyleData | undefined {
  if (!style) return undefined
  if (typeof style === 'string') {
    const resolved = styles[style]
    return resolved && typeof resolved === 'object' ? resolved : undefined
  }
  return style
}

function fromUniverStyle(style?: IStyleData): WorkbookCellStyle | undefined {
  if (!style) return undefined
  const align = style.ht === HORIZONTAL_ALIGNMENTS.left
    ? 'left'
    : style.ht === HORIZONTAL_ALIGNMENTS.center
      ? 'center'
      : style.ht === HORIZONTAL_ALIGNMENTS.right
        ? 'right'
        : undefined
  const verticalAlign = style.vt === VERTICAL_ALIGNMENTS.top
    ? 'top'
    : style.vt === VERTICAL_ALIGNMENTS.middle
      ? 'middle'
      : style.vt === VERTICAL_ALIGNMENTS.bottom
        ? 'bottom'
        : undefined
  const border = style.bd && (style.bd.t ?? style.bd.r ?? style.bd.b ?? style.bd.l)
  const result: WorkbookCellStyle = {
    ...(style.ff ? { font_family: style.ff } : {}),
    ...(style.fs ? { font_size: style.fs } : {}),
    ...(style.bl === BOOLEAN_TRUE ? { bold: true } : style.bl === BOOLEAN_FALSE ? { bold: false } : {}),
    ...(style.it === BOOLEAN_TRUE ? { italic: true } : style.it === BOOLEAN_FALSE ? { italic: false } : {}),
    ...(align ? { align } : {}),
    ...(verticalAlign ? { vertical_align: verticalAlign } : {}),
    ...(style.tb === WRAP ? { wrap: true } : style.tb !== undefined ? { wrap: false } : {}),
    ...(style.cl?.rgb ? { text_color: style.cl.rgb } : {}),
    ...(style.bg?.rgb ? { fill_color: style.bg.rgb } : {}),
    ...(style.pd ? { padding: { top: style.pd.t, right: style.pd.r, bottom: style.pd.b, left: style.pd.l } } : {}),
    ...(border ? { border: { width: 1, color: border.cl.rgb ?? undefined } } : {}),
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function toUniverStyle(style: WorkbookCellStyle): IStyleData {
  const verticalAlign = style.vertical_align ? VERTICAL_ALIGNMENTS[style.vertical_align] : undefined
  const border = style.border && style.border.width && style.border.width > 0
    ? { s: 1, cl: { rgb: style.border.color || '#000000' } }
    : undefined

  return {
    ...(style.font_family ? { ff: style.font_family } : {}),
    ...(style.font_size ? { fs: style.font_size } : {}),
    ...(style.bold === undefined ? {} : { bl: style.bold ? BOOLEAN_TRUE : BOOLEAN_FALSE }),
    ...(style.italic === undefined ? {} : { it: style.italic ? BOOLEAN_TRUE : BOOLEAN_FALSE }),
    ...(style.align ? { ht: HORIZONTAL_ALIGNMENTS[style.align] } : {}),
    ...(verticalAlign ? { vt: verticalAlign } : {}),
    ...(style.wrap === undefined ? {} : { tb: style.wrap ? WRAP : 2 }),
    ...(style.text_color ? { cl: { rgb: style.text_color } } : {}),
    ...(style.fill_color ? { bg: { rgb: style.fill_color } } : {}),
    ...(style.padding ? { pd: { t: style.padding.top, r: style.padding.right, b: style.padding.bottom, l: style.padding.left } } : {}),
    ...(border ? { bd: { t: border, r: border, b: border, l: border } } : {}),
  }
}
