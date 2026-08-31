import { describe, expect, it } from 'vitest'
import type { IWorkbookData } from '@univerjs/presets'
import type { FormDefinition } from '@/features/forms/types'
import type { ReportDefinition } from '../types'
import { isReportRegionGuide, withReportRegionGuides } from './guides'

const definition: Pick<ReportDefinition, 'blocks' | 'settings'> = {
  settings: {},
  blocks: [{
    id: 'pipeline',
    type: 'table',
    sheet_id: 'overview',
    layout: { row: 4, col: 1, row_span: 3, col_span: 4 },
    config: { form_id: 'pipeline-form' },
  }],
}

const pipelineForm = {
  id: 'pipeline-form',
  name: 'Pipeline',
  fields: [
    { name: 'deal', label: 'Deal', type: 'text' },
    { name: 'amount', label: 'Amount', type: 'number' },
    // A virtual parent-side line-item field is not a column, mirroring the
    // backend's own defaultColumns filter.
    { name: 'charge_count', label: 'Charges', type: 'line_item_count' },
  ],
} as unknown as FormDefinition

function sheet(cellData: Record<number, Record<number, unknown>> = {}): Partial<IWorkbookData> {
  return {
    sheetOrder: ['overview'],
    sheets: {
      overview: {
        id: 'overview',
        name: 'Overview',
        rowCount: 24,
        columnCount: 8,
        cellData,
        mergeData: [],
      },
    },
  } as Partial<IWorkbookData>
}

describe('workbook region guides', () => {
  it('marks an unconfigurable region without merging over an author-owned static cell', () => {
    // With no form loaded the columns are unknown, so the region stays a
    // single labelled cell and must not merge over the author's note.
    const workbook = withReportRegionGuides(sheet({ 5: { 3: { v: 'Keep this note' } } }), definition)

    const overview = workbook.sheets?.overview
    expect(isReportRegionGuide(overview?.cellData?.[4]?.[1])).toBe(true)
    expect(overview?.cellData?.[5]?.[3]).toMatchObject({ v: 'Keep this note' })
    expect(overview?.mergeData).toEqual([])
  })

  it('draws a configured table as real per-column header cells, not a merged placeholder', () => {
    const workbook = withReportRegionGuides(sheet(), definition, new Map([['pipeline-form', pipelineForm]]))
    const cells = workbook.sheets?.overview?.cellData

    // One header cell per column, at the region's anchor row.
    expect(cells?.[4]?.[1]).toMatchObject({ v: 'Deal' })
    expect(cells?.[4]?.[2]).toMatchObject({ v: 'Amount' })
    // The virtual line-item field is excluded, so there is no third column.
    expect(cells?.[4]?.[3]).toBeUndefined()

    // Headers are bold by default, matching HeaderCellStyle in the backend.
    expect(cells?.[4]?.[1]?.s).toMatchObject({ bl: 1 })

    // A real table is never merged — merging would destroy the grid.
    expect(workbook.sheets?.overview?.mergeData).toEqual([])
  })

  it('draws placeholder body rows beneath the header row', () => {
    const workbook = withReportRegionGuides(sheet(), definition, new Map([['pipeline-form', pipelineForm]]))
    const cells = workbook.sheets?.overview?.cellData

    for (const row of [5, 6, 7]) {
      expect(cells?.[row]?.[1]).toMatchObject({ v: '···' })
      expect(cells?.[row]?.[2]).toMatchObject({ v: '···' })
      expect(isReportRegionGuide(cells?.[row]?.[1])).toBe(true)
    }
    // Body cells inherit the body style, so they are not bold like headers.
    expect(cells?.[5]?.[1]?.s).not.toMatchObject({ bl: 1 })
  })

  it('yields any drawn cell to an author-owned static cell', () => {
    const workbook = withReportRegionGuides(
      sheet({ 4: { 2: { v: 'Author owns this' } } }),
      definition,
      new Map([['pipeline-form', pipelineForm]]),
    )
    const cells = workbook.sheets?.overview?.cellData

    expect(cells?.[4]?.[1]).toMatchObject({ v: 'Deal' })
    expect(cells?.[4]?.[2]).toMatchObject({ v: 'Author owns this' })
    expect(isReportRegionGuide(cells?.[4]?.[2])).toBe(false)
  })
})
