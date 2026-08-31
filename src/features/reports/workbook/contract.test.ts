import { describe, expect, it } from 'vitest'
import { fromUniverWorkbook, toUniverWorkbook } from './contract'
import type { ReportWorkbook } from '../types'

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
})
