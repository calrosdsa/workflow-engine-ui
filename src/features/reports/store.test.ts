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

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition).toEqual(definition)
  })

  it('is a no-op when the report has no workbook yet', () => {
    useReportStore.getState().loadDefinition({ ...definition, workbook: undefined })
    useReportStore.getState().updateSheetPrint('overview', { row_breaks: [1] })
    expect(useReportStore.getState().definition.workbook).toBeUndefined()
  })

  // C-5 (docs/report-builder-improvement-plan.md): every mutation entry
  // point must flush the live canvas first, or a new panel that forgets to
  // wire onBeforeChange silently discards unsaved grid edits. Mirrors the
  // 'report region binding' describe block's own
  // "includes a synchronized live workbook in the next semantic undo entry"
  // test at the top of this file, for the print-settings mutations RF-102
  // added — proving the same flush-survives-undo contract holds for a
  // field this file's earlier tests never touched.
  it('includes a synchronized live workbook in the next print-setting undo entry', () => {
    const editedWorkbook = {
      ...definition.workbook!,
      sheets: definition.workbook!.sheets.map((sheet, index) => index === 0
        ? { ...sheet, cells: [{ row: 0, col: 0, value: 'Unsaved workbook edit' }] }
        : sheet),
    }
    useReportStore.getState().syncWorkbookSnapshot(editedWorkbook)
    useReportStore.getState().updatePageSetup({ orientation: 'landscape' })

    useReportStore.getState().undo()

    expect(useReportStore.getState().definition.workbook).toEqual(editedWorkbook)
    expect(useReportStore.getState().definition.settings.page).toBeUndefined()
  })

  // Regression for a real bug found auditing this file: mutate()'s
  // coalescing branch (canCoalesce true) only refreshes the existing undo
  // entry's timestamp, never its definition — a flush landing BETWEEN two
  // coalesced edits of the SAME field had nowhere to go and undo silently
  // discarded it, reproduced empirically before syncWorkbookSnapshot's own
  // fix (patching the current top-of-stack entry) landed. This is a
  // stricter version of the test above: the flush happens mid-burst, not
  // before it.
  it('does not lose a workbook flush that lands BETWEEN two coalesced page-setup edits', () => {
    useReportStore.getState().updatePageSetup({ orientation: 'landscape' })

    const editedWorkbook = {
      ...definition.workbook!,
      sheets: definition.workbook!.sheets.map((sheet, index) => index === 0
        ? { ...sheet, cells: [{ row: 0, col: 0, value: 'Unsaved mid-burst edit' }] }
        : sheet),
    }
    useReportStore.getState().syncWorkbookSnapshot(editedWorkbook)

    // Same coalesceKey ('settings:page'), well within COALESCE_WINDOW_MS —
    // this must coalesce with the first call, not push a second undo entry.
    useReportStore.getState().updatePageSetup({ orientation: 'landscape', scale: 'fit_width' })

    useReportStore.getState().undo()

    const after = useReportStore.getState().definition
    expect(after.workbook).toEqual(editedWorkbook)
    // The whole coalesced group undoes as one step, same as every other
    // coalesced field — the fix must not weaken that guarantee.
    expect(after.settings.page).toBeUndefined()
  })

  // Same bug, the redoStack side: undo() pushes the pre-undo definition
  // onto redoStack, which is just as frozen as an undo entry until
  // syncWorkbookSnapshot patches it too.
  // main's fold test above exercises updatePageSetup; this is the same
  // contract for updateSheetPrint, which reaches the workbook through a
  // different path (per-sheet, coalesced by sheet id) and so could regress
  // independently. From claude/report-print-fidelity-contract (RF-102).
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

    expect(useReportStore.getState().definition.workbook).toEqual(editedWorkbook)
    expect(useReportStore.getState().definition.workbook!.sheets[0].print).toBeUndefined()
  })

  it('does not lose a workbook flush that lands between an undo and the following redo', () => {
    useReportStore.getState().updatePageSetup({ orientation: 'landscape' })
    useReportStore.getState().undo()

    const editedWorkbook = {
      ...definition.workbook!,
      sheets: definition.workbook!.sheets.map((sheet, index) => index === 0
        ? { ...sheet, cells: [{ row: 0, col: 0, value: 'Unsaved edit after undo' }] }
        : sheet),
    }
    useReportStore.getState().syncWorkbookSnapshot(editedWorkbook)

    useReportStore.getState().redo()

    const after = useReportStore.getState().definition
    expect(after.workbook).toEqual(editedWorkbook)
    expect(after.settings.page).toEqual({ orientation: 'landscape' })
  })
})
