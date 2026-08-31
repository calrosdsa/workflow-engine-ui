import { beforeEach, describe, expect, it } from 'vitest'
import { useReportStore } from './store'
import type { ReportDefinition } from './types'

const definition: ReportDefinition = {
  version: 2,
  name: 'Board pack',
  blocks: [
    {
      id: 'pipeline',
      type: 'table',
      sheet_id: 'overview',
      layout: { row: 4, col: 1, row_span: 6, col_span: 5 },
      config: { form_id: 'pipeline-form' },
    },
    {
      id: 'notes',
      type: 'text',
      sheet_id: 'overview',
      layout: { row: 0, col: 0, row_span: 1, col_span: 4 },
      config: { text: 'Board notes' },
    },
  ],
  workbook: {
    sheets: [
      { id: 'overview', name: 'Overview', row_count: 24, column_count: 8 },
      { id: 'details', name: 'Details', row_count: 24, column_count: 8 },
    ],
  },
  settings: {},
  visibility: { mode: 'public' },
}

describe('report region binding', () => {
  beforeEach(() => useReportStore.getState().loadDefinition(definition))

  it('moves one semantic block to another sheet without changing its data configuration', () => {
    useReportStore.getState().updateBlockRegion('pipeline', {
      sheet_id: 'details',
      layout: { row: 8, col: 2, row_span: 8, col_span: 4 },
    })

    const [pipeline, notes] = useReportStore.getState().definition.blocks
    expect(pipeline).toMatchObject({
      id: 'pipeline',
      sheet_id: 'details',
      layout: { row: 8, col: 2, row_span: 8, col_span: 4 },
      config: { form_id: 'pipeline-form' },
    })
    expect(notes).toEqual(definition.blocks[1])
    expect(useReportStore.getState().dirty).toBe(true)

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition).toEqual(definition)
  })

  it('includes a synchronized live workbook in the next semantic undo entry', () => {
    const editedWorkbook = {
      ...definition.workbook!,
      sheets: definition.workbook!.sheets.map((sheet, index) => index === 0
        ? { ...sheet, cells: [{ row: 0, col: 0, value: 'Unsaved workbook edit' }] }
        : sheet),
    }
    useReportStore.getState().syncWorkbookSnapshot(editedWorkbook)
    useReportStore.getState().updateBlockRegion('pipeline', {
      sheet_id: 'details',
      layout: { row: 8, col: 2, row_span: 8, col_span: 4 },
    })

    useReportStore.getState().undo()

    expect(useReportStore.getState().definition.workbook).toEqual(editedWorkbook)
    expect(useReportStore.getState().definition.blocks[0].sheet_id).toBe('overview')
  })
})
