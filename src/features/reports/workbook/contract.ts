import type {
  ICellData,
  IStyleData,
  IWorkbookData,
  IWorksheetData,
} from '@univerjs/presets'
import type {
  ColumnWidth,
  FreezePane,
  NumberFormat,
  ReportWorkbook,
  ReportWorkbookSheet,
  RowHeight,
  WorkbookCell,
  WorkbookCellStyle,
  WorkbookCellValue,
} from '../types'
import { isReportRegionGuide } from './guides'
import { descriptorForPattern, excelPattern, patternIndex } from './number-format'

type WorkbookSnapshot = Pick<IWorkbookData, 'id' | 'name' | 'sheetOrder' | 'sheets' | 'styles'>

const BOOLEAN_FALSE = 0
const BOOLEAN_TRUE = 1
const HORIZONTAL_ALIGNMENTS = { left: 1, center: 2, right: 3 } as const
const VERTICAL_ALIGNMENTS = { top: 1, middle: 2, bottom: 3 } as const
const WRAP = 3

// Univer's own BorderStyleTypes enum (0 NONE .. 13 THICK) groups its 14
// styles into three visual weights — thin (THIN/HAIR/DOTTED/DASHED/
// DASH_DOT/DASH_DOT_DOT/DOUBLE = 1-7), medium (MEDIUM/MEDIUM_DASHED/
// MEDIUM_DASH_DOT/MEDIUM_DASH_DOT_DOT/SLANT_DASH_DOT = 8-12), thick
// (THICK = 13) — it has no independent pixel-width field at all. The
// report's own WorkbookCellStyle.border.width (internal/reports/style.go)
// is a real px value every writer (PDF/DOCX/XLSX/HTML) renders as an
// actual line thickness, so `s` is never interchangeable with `width`: `s`
// can't hold a pixel count and `width` can't hold a dash pattern. These
// bucket one into the other by weight, which is the only dimension both
// sides share — the dash/double pattern itself is lost either direction,
// same as it already was.
const BORDER_STYLE_NONE = 0
const BORDER_STYLE_THIN = 1
const BORDER_STYLE_MEDIUM = 8
const BORDER_STYLE_THICK = 13

function univerBorderStyleToWidthPx(s: number): number {
  if (s <= BORDER_STYLE_NONE) return 0
  if (s < BORDER_STYLE_MEDIUM) return 1
  if (s < BORDER_STYLE_THICK) return 2
  return 3
}

function widthPxToUniverBorderStyle(width: number): number {
  if (width <= 0) return BORDER_STYLE_NONE
  if (width === 1) return BORDER_STYLE_THIN
  if (width === 2) return BORDER_STYLE_MEDIUM
  return BORDER_STYLE_THICK
}

// Converts the editor's current workbook into the app-owned v2 report
// contract. This is intentionally a whitelist: collaboration metadata,
// plugin resources and editor implementation details never enter a report
// definition, while ordinary cell values, formulas, merges and styles do.
/**
 * numberFormatIndex builds the pattern lookup a save needs, from the
 * definition being edited. Univer holds only the derived Excel pattern, so
 * without this every number format an author set would be dropped on the
 * round trip — which is precisely what happened before this existed.
 */
export function numberFormatIndex(workbook: ReportWorkbook | undefined): Map<string, NumberFormat> {
  const formats: NumberFormat[] = []
  workbook?.sheets.forEach((sheet) => {
    sheet.cells?.forEach((cell) => {
      if (cell.style?.number_format) formats.push(cell.style.number_format)
    })
  })
  return patternIndex(formats)
}

export function fromUniverWorkbook(
  snapshot: WorkbookSnapshot,
  formats: Map<string, NumberFormat> = new Map(),
): ReportWorkbook {
  const sheetIDs = snapshot.sheetOrder?.filter((id) => snapshot.sheets[id] !== undefined)
    ?? Object.keys(snapshot.sheets)

  return {
    sheets: sheetIDs.map((sheetID) => fromUniverSheet(sheetID, snapshot.sheets[sheetID] ?? {}, snapshot.styles, formats)),
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

    const rowData: Record<number, { h: number }> = {}
    sheet.row_heights?.forEach((rh) => {
      rowData[rh.row] = { h: rh.height }
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
      freeze: sheet.freeze
        ? { xSplit: sheet.freeze.x_split, ySplit: sheet.freeze.y_split, startRow: sheet.freeze.start_row, startColumn: sheet.freeze.start_column }
        : { xSplit: 0, ySplit: 0, startRow: 0, startColumn: 0 },
      cellData,
      mergeData: sheet.merges?.map((merge) => ({
        startRow: merge.start_row,
        endRow: merge.end_row,
        startColumn: merge.start_col,
        endColumn: merge.end_col,
      })) ?? [],
      ...(Object.keys(columnData).length > 0 ? { columnData } : {}),
      ...(Object.keys(rowData).length > 0 ? { rowData } : {}),
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
  formats: Map<string, NumberFormat>,
): ReportWorkbookSheet {
  const cells: WorkbookCell[] = []
  const cellData = sheet.cellData ?? {}

  Object.entries(cellData).forEach(([rowKey, row]) => {
    Object.entries(row ?? {}).forEach(([columnKey, rawCell]) => {
      const cell = rawCell as ICellData
      if (isReportRegionGuide(cell)) return
      const value = isWorkbookCellValue(cell.v) ? cell.v : undefined
      const style = fromUniverStyle(resolveStyle(cell.s, styles), formats)
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
  const rowCount = sheet.rowCount ?? 36

  // Univer always carries a freeze object, {xSplit:0,ySplit:0,...} included
  // — only a real split is a customization worth persisting, matching the
  // "no entry = editor default" convention column_widths already uses.
  // xSplit/ySplit are clamped to leave at least one column/row in the
  // scrollable pane: a narrow sheet's freeze-column drag handle (or a
  // "freeze columns" command run over every column) can genuinely reach
  // xSplit === columnCount, which the backend rejects outright — there is
  // no valid TopLeftCell inside the report's own declared grid once the
  // whole sheet is "frozen", so this is a real editor gesture that must not
  // reach an unrecoverable save-time validation error. startRow/startColumn
  // are clamped the same way, in lockstep, so they never point below the
  // (possibly now-clamped) split.
  const freeze: FreezePane | undefined = sheet.freeze && (sheet.freeze.xSplit > 0 || sheet.freeze.ySplit > 0)
    ? (() => {
        const xSplit = Math.min(sheet.freeze!.xSplit, Math.max(columnCount - 1, 0))
        const ySplit = Math.min(sheet.freeze!.ySplit, Math.max(rowCount - 1, 0))
        return {
          x_split: xSplit,
          y_split: ySplit,
          start_row: Math.min(Math.max(sheet.freeze!.startRow, ySplit), Math.max(rowCount - 1, 0)),
          start_column: Math.min(Math.max(sheet.freeze!.startColumn, xSplit), Math.max(columnCount - 1, 0)),
        }
      })()
    : undefined

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

  // Only `h` (an explicit resize) counts. IRowData also carries `ia`/`ah`
  // (auto-height sizing) and `hd` (hidden) — deliberately ignored, mirroring
  // columnData's own `hd`-without-`w` exclusion above, so an auto-sized row
  // Univer computed on its own never gets mistaken for an author's real
  // resize and pinned into the saved definition.
  const rowHeights: RowHeight[] = Object.entries(sheet.rowData ?? {})
    .map(([rowKey, row]) => ({ row: Number(rowKey), height: row?.h }))
    .filter((rh): rh is RowHeight => typeof rh.height === 'number' && rh.height > 0 && rh.row >= 0 && rh.row < rowCount)
    .sort((a, b) => a.row - b.row)

  return {
    id: sheet.id ?? fallbackID,
    name: sheet.name ?? fallbackID,
    row_count: rowCount,
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
    ...(rowHeights.length > 0 ? { row_heights: rowHeights } : {}),
    ...(freeze ? { freeze } : {}),
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

function fromUniverStyle(
  style: IStyleData | undefined,
  formats: Map<string, NumberFormat>,
): WorkbookCellStyle | undefined {
  if (!style) return undefined
  // Univer stores an Excel pattern; the report stores a descriptor. This
  // recovers the descriptor by lookup, never by parsing — see
  // number-format.ts for why parsing is off the table. A pattern with no
  // entry means it did not come from this editor's own panel, and there is
  // no descriptor that could faithfully represent it, so it is left off
  // rather than guessed at.
  const numberFormat = descriptorForPattern(style.n?.pattern, formats)
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
  const borderWidthPx = border ? univerBorderStyleToWidthPx(border.s) : 0
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
    ...(border && borderWidthPx > 0 ? { border: { width: borderWidthPx, color: border.cl.rgb ?? undefined } } : {}),
    ...(numberFormat ? { number_format: numberFormat } : {}),
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function toUniverStyle(style: WorkbookCellStyle): IStyleData {
  const verticalAlign = style.vertical_align ? VERTICAL_ALIGNMENTS[style.vertical_align] : undefined
  const border = style.border && style.border.width && style.border.width > 0
    ? { s: widthPxToUniverBorderStyle(style.border.width), cl: { rgb: style.border.color || '#000000' } }
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
    // Display only. The descriptor stays the source of truth; this is what
    // makes the grid show "Bs 1,234.56" instead of a bare 1234.56.
    ...(style.number_format ? { n: { pattern: excelPattern(style.number_format) } } : {}),
  }
}
