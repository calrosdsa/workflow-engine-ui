// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UniverWorkbookSurface, type WorkbookSurfaceHandle } from './UniverWorkbookSurface'
import type { ReportDefinition } from '../types'

const univer = vi.hoisted(() => {
  const createWorkbook = vi.fn()
  const dispose = vi.fn()
  const addEvent = vi.fn(() => ({ dispose: vi.fn() }))
  return {
    createWorkbook,
    dispose,
    addEvent,
    createUniver: vi.fn(() => ({
      univerAPI: {
        createWorkbook,
        dispose,
        addEvent,
        Event: { CommandExecuted: 'CommandExecuted' },
      },
    })),
  }
})

vi.mock('@univerjs/presets', () => ({
  BooleanNumber: { FALSE: 0, TRUE: 1 },
  HorizontalAlign: { LEFT: 1, CENTER: 2, RIGHT: 3 },
  LocaleType: { EN_US: 'en-US' },
  VerticalAlign: { MIDDLE: 2 },
  WrapStrategy: { WRAP: 3 },
  createUniver: univer.createUniver,
  mergeLocales: vi.fn((locales: unknown) => locales),
}))

vi.mock('@univerjs/preset-sheets-core', () => ({
  UniverSheetsCorePreset: vi.fn((config: unknown) => config),
}))

vi.mock('@univerjs/preset-sheets-core/locales/en-US', () => ({ default: {} }))

vi.mock('@univerjs/preset-sheets-table', () => ({
  UniverSheetsTablePreset: vi.fn(() => ({})),
}))

vi.mock('@univerjs/preset-sheets-table/locales/en-US', () => ({ default: {} }))

// Region headers resolve against the form list, so the surface reads it.
vi.mock('@/features/forms/hooks', () => ({
  useForms: () => ({ data: [] }),
}))

const definition: ReportDefinition = {
  version: 1,
  name: 'Board report',
  settings: {},
  visibility: { mode: 'public' },
  blocks: [
    {
      id: 'title',
      type: 'text',
      layout: { row: 0, col: 0, row_span: 1, col_span: 4 },
      config: { text: 'Q3 board report' },
      style: { bold: true, text_color: '#0f172a' },
    },
  ],
}

describe('UniverWorkbookSurface', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('creates a projected workbook and disposes the editor on unmount', () => {
    const { unmount } = render(<UniverWorkbookSurface definition={definition} />)

    // The bar now leads with the primary action rather than a "Workbook"
    // label — placing data is a sheet gesture (FR-J1-006 SN-01).
    expect(screen.getByRole('button', { name: /Insert data/ })).toBeTruthy()
    expect(screen.getByText('Static cell values, formulas, formatting, and merges save with this report.')).toBeTruthy()
    expect(univer.createUniver).toHaveBeenCalledTimes(1)
    expect(univer.createWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      id: 'report-builder-workbook',
      name: 'Board report',
      sheets: expect.objectContaining({
        'report-layout': expect.objectContaining({
          cellData: expect.objectContaining({
            0: expect.objectContaining({
              0: expect.objectContaining({ v: 'Q3 board report' }),
            }),
          }),
        }),
      }),
    }))

    unmount()
    expect(univer.dispose).toHaveBeenCalledTimes(1)
  })

  it('shows version-2 semantic blocks as guides without adding them to the saved cell contract', () => {
    render(<UniverWorkbookSurface definition={{
      ...definition,
      version: 2,
      workbook: {
        sheets: [{ id: 'overview', name: 'Overview', row_count: 24, column_count: 8 }],
      },
      blocks: [{
        ...definition.blocks[0],
        sheet_id: 'overview',
        layout: { row: 4, col: 1, row_span: 3, col_span: 4 },
      }],
    }} />)

    expect(univer.createWorkbook).toHaveBeenCalledWith(expect.objectContaining({
      sheets: expect.objectContaining({
        overview: expect.objectContaining({
          cellData: expect.objectContaining({
            4: expect.objectContaining({
              1: expect.objectContaining({
                // A region guide now shows the block's real content rather
                // than a generic "Data region" label.
                v: 'Q3 board report',
                custom: expect.objectContaining({ report_builder_region: 'title' }),
              }),
            }),
          }),
          mergeData: expect.arrayContaining([
            expect.objectContaining({ startRow: 4, endRow: 6, startColumn: 1, endColumn: 4 }),
          ]),
        }),
      }),
    }))
  })

  it('registers a named data region as a sheet table so its structured references resolve while editing', () => {
    const addTable = vi.fn()
    univer.createWorkbook.mockReturnValue({
      save: vi.fn(),
      getSheetBySheetId: vi.fn(() => ({ addTable })),
    })

    render(<UniverWorkbookSurface definition={{
      ...definition,
      blocks: [{
        id: 'charges',
        name: 'Charges',
        type: 'table',
        layout: { row: 4, col: 1, row_span: 2, col_span: 2 },
        // Columns are explicit, so the region draws a real header row even
        // with no form loaded in this test.
        config: { form_id: 'invoices', columns: [{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount' }] },
      }],
    }} />)

    expect(addTable).toHaveBeenCalledWith(
      'Charges',
      // Header row plus three placeholder rows, across both columns.
      { startRow: 4, endRow: 7, startColumn: 1, endColumn: 2 },
      'report-region-charges',
    )
  })

  it('does not register a region whose name is unusable in a formula', () => {
    const addTable = vi.fn()
    univer.createWorkbook.mockReturnValue({
      save: vi.fn(),
      getSheetBySheetId: vi.fn(() => ({ addTable })),
    })

    render(<UniverWorkbookSurface definition={{
      ...definition,
      blocks: [{
        id: 'charges',
        // A space makes this unreferenceable as Charges[Amount], so
        // registering it would promise something the export cannot honor.
        name: 'Line Charges',
        type: 'table',
        layout: { row: 4, col: 1, row_span: 2, col_span: 2 },
        config: { form_id: 'invoices', columns: [{ key: 'amount', label: 'Amount' }] },
      }],
    }} />)

    expect(addTable).not.toHaveBeenCalled()
  })

  it('exposes the active sheet selection as a semantic region binding', () => {
    univer.createWorkbook.mockReturnValue({
      save: vi.fn(),
      getActiveSheet: () => ({
        getSheetId: () => 'overview',
        getActiveRange: () => ({
          getRange: () => ({ startRow: 6, endRow: 9, startColumn: 2, endColumn: 4 }),
        }),
      }),
    })
    const ref = createRef<WorkbookSurfaceHandle>()
    render(<UniverWorkbookSurface ref={ref} definition={definition} />)

    expect(ref.current?.getSelection()).toEqual({
      sheet_id: 'overview',
      layout: { row: 6, col: 2, row_span: 4, col_span: 3 },
    })
  })

  it('keeps the live editor mounted for changes that do not alter a drawn region', () => {
    const workbookDefinition: ReportDefinition = {
      ...definition,
      version: 2,
      workbook: { sheets: [{ id: 'overview', name: 'Overview', row_count: 24, column_count: 8 }] },
      blocks: [{ ...definition.blocks[0], sheet_id: 'overview' }],
    }
    const { rerender } = render(<UniverWorkbookSurface definition={workbookDefinition} />)

    // The report name lives outside the grid, so it never rebuilds.
    rerender(<UniverWorkbookSurface definition={{ ...workbookDefinition, name: 'Renamed report' }} />)
    expect(univer.createWorkbook).toHaveBeenCalledTimes(1)
  })

  it('redraws when a region’s content, styling, or placement changes', () => {
    const workbookDefinition: ReportDefinition = {
      ...definition,
      version: 2,
      workbook: { sheets: [{ id: 'overview', name: 'Overview', row_count: 24, column_count: 8 }] },
      blocks: [{ ...definition.blocks[0], sheet_id: 'overview' }],
    }
    const { rerender } = render(<UniverWorkbookSurface definition={workbookDefinition} />)

    // A config change now alters the cells a region draws (its columns and
    // their labels), so unlike the previous placeholder-only guide it has to
    // redraw. ReportBuilderPage captures live cell edits into the definition
    // before any such change, so rebuilding restores the author's own cells
    // rather than discarding them.
    rerender(<UniverWorkbookSurface definition={{
      ...workbookDefinition,
      blocks: [{ ...workbookDefinition.blocks[0], config: { text: 'Updated heading' } }],
    }} />)
    expect(univer.createWorkbook).toHaveBeenCalledTimes(2)

    rerender(<UniverWorkbookSurface definition={{
      ...workbookDefinition,
      blocks: [{ ...workbookDefinition.blocks[0], config: { text: 'Updated heading' }, style: { bold: false } }],
    }} />)
    expect(univer.createWorkbook).toHaveBeenCalledTimes(3)

    rerender(<UniverWorkbookSurface definition={{
      ...workbookDefinition,
      blocks: [{ ...workbookDefinition.blocks[0], config: { text: 'Updated heading' }, style: { bold: false }, layout: { row: 3, col: 1, row_span: 1, col_span: 4 } }],
    }} />)
    expect(univer.createWorkbook).toHaveBeenCalledTimes(4)
  })
})
