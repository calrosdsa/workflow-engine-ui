import { describe, expect, it } from 'vitest'
import { fromUniverWorkbook, numberFormatIndex, toUniverWorkbook } from './contract'
import type { NumberFormat, ReportWorkbook } from '../types'

describe('report workbook contract', () => {
  it('turns a Univer workbook into portable report cells, formulas, styles, and merges', () => {
    const workbook = fromUniverWorkbook({
      id: 'report-builder-workbook',
      name: 'Board pack',
      sheetOrder: ['overview'],
      styles: {
        banner: { ff: 'Inter', fs: 14, bl: 1, bg: { rgb: '#ecfeff' }, cl: { rgb: '#0f172a' }, ht: 2, tb: 3 },
      },
      sheets: {
        overview: {
          id: 'overview',
          name: 'Overview',
          rowCount: 36,
          columnCount: 12,
          cellData: {
            0: { 0: { v: 'Board pack', s: 'banner' } },
            3: { 2: { f: '=SUM(C1:C2)', v: 42 } },
          },
          mergeData: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 3 }],
        },
      },
    })

    expect(workbook).toEqual({
      sheets: [{
        id: 'overview',
        name: 'Overview',
        row_count: 36,
        column_count: 12,
        cells: [
          {
            row: 0,
            col: 0,
            value: 'Board pack',
            style: {
              font_family: 'Inter',
              font_size: 14,
              bold: true,
              align: 'center',
              wrap: true,
              text_color: '#0f172a',
              fill_color: '#ecfeff',
            },
          },
          { row: 3, col: 2, formula: '=SUM(C1:C2)' },
        ],
        merges: [{ start_row: 0, end_row: 0, start_col: 0, end_col: 3 }],
      }],
    })
  })

  it('rehydrates a portable workbook into a Univer snapshot', () => {
    const workbook: ReportWorkbook = {
      sheets: [{
        id: 'overview',
        name: 'Overview',
        row_count: 20,
        column_count: 8,
        cells: [
          { row: 1, col: 1, value: 'Approved', style: { bold: true, fill_color: '#dcfce7' } },
          { row: 2, col: 1, formula: '=B2*2' },
        ],
        merges: [{ start_row: 1, end_row: 1, start_col: 1, end_col: 3 }],
      }],
    }

    const snapshot = toUniverWorkbook('Board pack', workbook)

    expect(snapshot).toEqual(expect.objectContaining({
      name: 'Board pack',
      sheetOrder: ['overview'],
      sheets: expect.objectContaining({
        overview: expect.objectContaining({
          cellData: expect.objectContaining({
            1: expect.objectContaining({
              1: expect.objectContaining({ v: 'Approved', s: expect.objectContaining({ bl: 1, bg: { rgb: '#dcfce7' } }) }),
            }),
            2: expect.objectContaining({
              1: expect.objectContaining({ f: '=B2*2' }),
            }),
          }),
          mergeData: [{ startRow: 1, endRow: 1, startColumn: 1, endColumn: 3 }],
        }),
      }),
    }))
  })

  it('does not persist visual guides for semantic data regions as static workbook cells', () => {
    const workbook = fromUniverWorkbook({
      id: 'report-builder-workbook',
      name: 'Board pack',
      sheetOrder: ['overview'],
      styles: {},
      sheets: {
        overview: {
          id: 'overview',
          name: 'Overview',
          rowCount: 20,
          columnCount: 8,
          cellData: {
            4: { 1: { v: 'Data region · table', custom: { report_builder_region: 'pipeline' } } },
            8: { 0: { v: 'Prepared for the board' } },
          },
          mergeData: [
            { startRow: 4, endRow: 9, startColumn: 1, endColumn: 5 },
            { startRow: 8, endRow: 8, startColumn: 0, endColumn: 3 },
          ],
        },
      },
    })

    expect(workbook).toEqual({
      sheets: [{
        id: 'overview',
        name: 'Overview',
        row_count: 20,
        column_count: 8,
        cells: [{ row: 8, col: 0, value: 'Prepared for the board' }],
        merges: [{ start_row: 8, end_row: 8, start_col: 0, end_col: 3 }],
      }],
    })
  })

  // A resized column is the bug this feature closes: Univer already lets a
  // user drag a column wider in the editor (columnData), but fromUniverSheet
  // never read it, so the resize was silently lost on the next save/reload.
  it('persists a user-resized column as column_widths', () => {
    const workbook = fromUniverWorkbook({
      id: 'report-builder-workbook',
      name: 'Board pack',
      sheetOrder: ['overview'],
      styles: {},
      sheets: {
        overview: {
          id: 'overview',
          name: 'Overview',
          rowCount: 20,
          columnCount: 8,
          cellData: {},
          columnData: {
            0: { w: 240 },
            // A hidden or otherwise-flagged column can carry a columnData
            // entry with no width at all — that's not a real resize and
            // must not turn into a bogus column_widths entry.
            3: { hd: 1 },
          },
        },
      },
    })

    expect(workbook.sheets[0].column_widths).toEqual([{ col: 0, width: 240 }])
  })

  it('drops a columnData entry outside the sheet\'s own column_count', () => {
    const workbook = fromUniverWorkbook({
      id: 'report-builder-workbook',
      name: 'Board pack',
      sheetOrder: ['overview'],
      styles: {},
      sheets: {
        overview: {
          id: 'overview',
          name: 'Overview',
          rowCount: 20,
          columnCount: 4,
          cellData: {},
          columnData: { 9: { w: 200 } },
        },
      },
    })

    expect(workbook.sheets[0].column_widths).toBeUndefined()
  })

  it('rehydrates column_widths into Univer columnData, leaving an unspecified column at the editor default', () => {
    const workbook: ReportWorkbook = {
      sheets: [{
        id: 'overview',
        name: 'Overview',
        row_count: 20,
        column_count: 4,
        column_widths: [{ col: 1, width: 260 }],
      }],
    }

    const snapshot = toUniverWorkbook('Board pack', workbook)

    expect(snapshot.sheets?.overview).toEqual(expect.objectContaining({
      defaultColumnWidth: 112,
      columnData: { 1: { w: 260 } },
    }))
  })

  it('omits columnData entirely when no sheet has an explicit column width', () => {
    const workbook: ReportWorkbook = {
      sheets: [{ id: 'overview', name: 'Overview', row_count: 20, column_count: 4 }],
    }

    const snapshot = toUniverWorkbook('Board pack', workbook)

    expect(snapshot.sheets?.overview).not.toHaveProperty('columnData')
  })
})

// A border's WIDTH used to be discarded on both sides of the round trip:
// fromUniverStyle hardcoded `width: 1` no matter which of Univer's 14 border
// styles the author actually picked, and toUniverStyle hardcoded `s: 1`
// (THIN) no matter what width a definition carried — so every writer
// (PDF/DOCX/XLSX/HTML), which genuinely renders width as a real line
// thickness, always drew the same hairline regardless of authoring intent.
// `s` is a style enum, not a pixel count, so these pin the lossy-but-honest
// weight bucketing (thin/medium/thick) that replaced the flat hardcode,
// not a claim that the dash/double pattern itself survives.
describe('border width', () => {
  const cellWithBorderStyle = (s: number) => ({
    id: 'report-builder-workbook',
    name: 'Board pack',
    sheetOrder: ['overview'],
    styles: {},
    sheets: {
      overview: {
        id: 'overview',
        name: 'Overview',
        rowCount: 4,
        columnCount: 4,
        cellData: {
          0: { 0: { v: 'x', s: { bd: { t: { s, cl: { rgb: '#ff0000' } } } } } },
        },
      },
    },
  })

  it('maps a THIN Univer border style to a 1px width on save', () => {
    const workbook = fromUniverWorkbook(cellWithBorderStyle(1))
    expect(workbook.sheets[0].cells?.[0].style?.border).toEqual({ width: 1, color: '#ff0000' })
  })

  it('maps a MEDIUM Univer border style to a 2px width, distinct from THIN', () => {
    const workbook = fromUniverWorkbook(cellWithBorderStyle(8))
    expect(workbook.sheets[0].cells?.[0].style?.border).toEqual({ width: 2, color: '#ff0000' })
  })

  it('maps a THICK Univer border style to a 3px width, distinct from MEDIUM', () => {
    const workbook = fromUniverWorkbook(cellWithBorderStyle(13))
    expect(workbook.sheets[0].cells?.[0].style?.border).toEqual({ width: 3, color: '#ff0000' })
  })

  it('emits no border at all for a NONE Univer border style', () => {
    const workbook = fromUniverWorkbook(cellWithBorderStyle(0))
    expect(workbook.sheets[0].cells?.[0].style?.border).toBeUndefined()
  })

  it('maps a 3px definition width back to the THICK Univer style on load, not the flat THIN default', () => {
    const workbook: ReportWorkbook = {
      sheets: [{
        id: 'overview',
        name: 'Overview',
        row_count: 4,
        column_count: 4,
        cells: [{ row: 0, col: 0, value: 'x', style: { border: { width: 3, color: '#ff0000' } } }],
      }],
    }

    const snapshot = toUniverWorkbook('Board pack', workbook)
    const style = snapshot.sheets?.overview?.cellData?.[0]?.[0]?.s

    expect(typeof style === 'object' ? style?.bd?.t : undefined).toEqual({ s: 13, cl: { rgb: '#ff0000' } })
  })

  it('survives a full round trip distinguishing THIN from THICK', () => {
    const thin: ReportWorkbook = {
      sheets: [{
        id: 'overview', name: 'Overview', row_count: 4, column_count: 4,
        cells: [{ row: 0, col: 0, value: 'x', style: { border: { width: 1, color: '#000000' } } }],
      }],
    }
    const thick: ReportWorkbook = {
      sheets: [{
        id: 'overview', name: 'Overview', row_count: 4, column_count: 4,
        cells: [{ row: 0, col: 0, value: 'x', style: { border: { width: 3, color: '#000000' } } }],
      }],
    }

    const thinBack = fromUniverWorkbook(toUniverWorkbook('R', thin) as Parameters<typeof fromUniverWorkbook>[0])
    const thickBack = fromUniverWorkbook(toUniverWorkbook('R', thick) as Parameters<typeof fromUniverWorkbook>[0])

    expect(thinBack.sheets[0].cells?.[0].style?.border?.width).toBe(1)
    expect(thickBack.sheets[0].cells?.[0].style?.border?.width).toBe(3)
    expect(thinBack.sheets[0].cells?.[0].style?.border?.width)
      .not.toBe(thickBack.sheets[0].cells?.[0].style?.border?.width)
  })
})

// A number format applied in the editor used to be DISCARDED on save.
// Univer's own numfmt controls were live — the toolbar's "General" dropdown
// plus percent, currency and decimal buttons — and fromUniverStyle never
// read style.n, so an author could format a column, watch it render, save,
// and find it gone. These pin the round trip that closes it.
describe('number formats', () => {
  const bolivianos: NumberFormat = {
    style: 'currency',
    currency_symbol: 'Bs ',
    decimals: 2,
    thousands_separator: '.',
    decimal_separator: ',',
  }

  const withFormat = (): ReportWorkbook => ({
    sheets: [{
      id: 'overview',
      name: 'Overview',
      row_count: 4,
      column_count: 4,
      cells: [{ row: 0, col: 0, value: 1250000, style: { number_format: bolivianos } }],
    }],
  })

  it('survives a full round trip through Univer', () => {
    const univer = toUniverWorkbook('R', withFormat())
    const back = fromUniverWorkbook(
      univer as Parameters<typeof fromUniverWorkbook>[0],
      numberFormatIndex(withFormat()),
    )
    expect(back.sheets[0].cells?.[0].style?.number_format).toEqual(bolivianos)
  })

  it('reaches Univer as a real pattern so the grid renders it', () => {
    const univer = toUniverWorkbook('R', withFormat())
    const style = univer.sheets?.overview?.cellData?.[0]?.[0]?.s
    expect(typeof style === 'object' ? style?.n?.pattern : undefined).toBe('"Bs "#,##0.00')
  })

  // Without the index there is no descriptor to recover — the pattern alone
  // cannot produce one, which is exactly why the index has to be threaded
  // through from the definition rather than read out of Univer.
  it('is dropped rather than guessed at when the pattern is unknown', () => {
    const univer = toUniverWorkbook('R', withFormat())
    const back = fromUniverWorkbook(univer as Parameters<typeof fromUniverWorkbook>[0])
    expect(back.sheets[0].cells?.[0].style?.number_format).toBeUndefined()
    // The cell itself and its value must still survive.
    expect(back.sheets[0].cells?.[0].value).toBe(1250000)
  })
})
