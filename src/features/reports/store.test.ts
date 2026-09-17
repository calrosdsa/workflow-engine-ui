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

// RF-102's own stated acceptance criterion ("every print mutation flushes
// the live Univer workbook before changing the definition") is a store-side
// guarantee plus a caller-side one (see ReportSettingsPanel.test.tsx for the
// onBeforeChange half — the store itself cannot call it, since flushing the
// live Univer canvas is a DOM-adjacent concern the store has no access to).
// This is the store's half, proven the same way the existing "includes a
// synchronized live workbook in the next semantic undo entry" test above
// proves it for updateBlockRegion: syncWorkbookSnapshot writes the live
// canvas into the definition WITHOUT its own undo entry, so the next
// mutate()-based action must fold that synced workbook into ITS entry, or
// undoing a print-setting change would silently resurrect a stale grid and
// discard whatever cell edits the panel had just flushed.
describe('report print settings', () => {
  beforeEach(() => useReportStore.getState().loadDefinition(definition))

  it('updatePageSetup sets settings.page, undo restores it', () => {
    useReportStore.getState().updatePageSetup({ paper_size: 'letter', orientation: 'portrait' })

    expect(useReportStore.getState().definition.settings.page).toEqual({ paper_size: 'letter', orientation: 'portrait' })
    expect(useReportStore.getState().dirty).toBe(true)

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition).toEqual(definition)
  })

  it('updatePageSetup folds a synchronized live workbook into its own undo entry', () => {
    const editedWorkbook = {
      ...definition.workbook!,
      sheets: definition.workbook!.sheets.map((sheet, index) => index === 0
        ? { ...sheet, cells: [{ row: 0, col: 0, value: 'Unsaved workbook edit' }] }
        : sheet),
    }
    useReportStore.getState().syncWorkbookSnapshot(editedWorkbook)
    useReportStore.getState().updatePageSetup({ paper_size: 'letter' })

    useReportStore.getState().undo()

    expect(useReportStore.getState().definition.workbook).toEqual(editedWorkbook)
    expect(useReportStore.getState().definition.settings.page).toBeUndefined()
  })

  it('updateSheetPrint sets only the targeted sheet, undo restores it', () => {
    useReportStore.getState().updateSheetPrint('overview', { row_breaks: [10] })

    const [overview, details] = useReportStore.getState().definition.workbook!.sheets
    expect(overview.print).toEqual({ row_breaks: [10] })
    expect(details.print).toBeUndefined()

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition).toEqual(definition)
  })

  it('updateSheetPrint folds a synchronized live workbook into its own undo entry', () => {
    const editedWorkbook = {
      ...definition.workbook!,
      sheets: definition.workbook!.sheets.map((sheet, index) => index === 0
        ? { ...sheet, cells: [{ row: 0, col: 0, value: 'Unsaved workbook edit' }] }
        : sheet),
    }
    useReportStore.getState().syncWorkbookSnapshot(editedWorkbook)
    useReportStore.getState().updateSheetPrint('overview', { row_breaks: [10] })

    useReportStore.getState().undo()

    // The pre-print-mutation state must be exactly the synced workbook, with
    // no print field added — not the ORIGINAL pre-sync workbook, which would
    // mean the sync's own cell edit was silently discarded by the undo.
    expect(useReportStore.getState().definition.workbook).toEqual(editedWorkbook)
    expect(useReportStore.getState().definition.workbook!.sheets[0].print).toBeUndefined()
  })
})
