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

describe('report print settings (RF-102/RF-301)', () => {
  beforeEach(() => useReportStore.getState().loadDefinition(definition))

  it('sets the report-wide page setup and undoes it as one entry', () => {
    useReportStore.getState().updatePageSetup({ paper_size: 'legal', orientation: 'landscape' })
    expect(useReportStore.getState().definition.settings.page).toEqual({ paper_size: 'legal', orientation: 'landscape' })

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition.settings.page).toBeUndefined()
  })

  it('coalesces consecutive page-setup edits into one undo step, like style_defaults', () => {
    useReportStore.getState().updatePageSetup({ orientation: 'landscape' })
    useReportStore.getState().updatePageSetup({ orientation: 'landscape', scale: 'fit_width' })

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition.settings.page).toBeUndefined()
  })

  it('sets one sheet\'s print settings without touching the other sheet', () => {
    useReportStore.getState().updateSheetPrint('overview', { area: { start_row: 0, end_row: 5, start_col: 0, end_col: 3 } })

    const [overview, details] = useReportStore.getState().definition.workbook!.sheets
    expect(overview.print).toEqual({ area: { start_row: 0, end_row: 5, start_col: 0, end_col: 3 } })
    expect(details.print).toBeUndefined()
  })

  it('is a no-op when the report has no workbook yet', () => {
    useReportStore.getState().loadDefinition({ ...definition, workbook: undefined })
    useReportStore.getState().updateSheetPrint('overview', { row_breaks: [1] })
    expect(useReportStore.getState().definition.workbook).toBeUndefined()
  })
})
