// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/reports/blocks'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { useReportStore } from '../store'
import type { ReportDefinition } from '../types'
import { WorkbookRegionsPanel } from './WorkbookRegionsPanel'

const definition: ReportDefinition = {
  version: 2,
  name: 'Board pack',
  blocks: [{
    id: 'pipeline',
    type: 'table',
    sheet_id: 'overview',
    layout: { row: 4, col: 1, row_span: 6, col_span: 5 },
    config: { form_id: 'pipeline-form' },
  }],
  workbook: {
    sheets: [
      { id: 'overview', name: 'Overview', row_count: 24, column_count: 8 },
      { id: 'details', name: 'Details', row_count: 24, column_count: 8 },
    ],
  },
  settings: {},
  visibility: { mode: 'public' },
}

describe('WorkbookRegionsPanel', () => {
  beforeEach(() => useReportStore.getState().loadDefinition(definition))
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('updates a selected data region in workbook coordinates without changing its config', () => {
    const onBeforeChange = vi.fn()
    renderPanel(<WorkbookRegionsPanel onBeforeChange={onBeforeChange} />)

    fireEvent.click(screen.getByRole('button', { name: /table · pipeline/i }))
    fireEvent.change(screen.getByLabelText('Row'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Column'), { target: { value: '3' } })

    const block = useReportStore.getState().definition.blocks[0]
    expect(block).toMatchObject({
      sheet_id: 'overview',
      layout: { row: 8, col: 2, row_span: 6, col_span: 5 },
      config: { form_id: 'pipeline-form' },
    })
    expect(onBeforeChange).toHaveBeenCalledTimes(2)
  })

  it('places the selected data region at the active workbook selection', () => {
    const getSelection = vi.fn(() => ({
      sheet_id: 'details',
      layout: { row: 10, col: 3, row_span: 4, col_span: 2 },
    }))
    const onBeforeChange = vi.fn()
    renderPanel(<WorkbookRegionsPanel getSelection={getSelection} onBeforeChange={onBeforeChange} />)

    fireEvent.click(screen.getByRole('button', { name: /table · pipeline/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Place at selected cells' }))

    expect(getSelection).toHaveBeenCalledOnce()
    expect(useReportStore.getState().definition.blocks[0]).toMatchObject({
      sheet_id: 'details',
      layout: { row: 10, col: 3, row_span: 4, col_span: 2 },
      config: { form_id: 'pipeline-form' },
    })
    expect(onBeforeChange).toHaveBeenCalledOnce()
  })

  it('creates and selects a region at the active workbook selection', () => {
    useReportStore.getState().loadDefinition({ ...definition, blocks: [] })
    const getSelection = vi.fn(() => ({
      sheet_id: 'details',
      layout: { row: 7, col: 2, row_span: 3, col_span: 4 },
    }))
    const onBeforeChange = vi.fn()

    renderPanel(<WorkbookRegionsPanel getSelection={getSelection} onBeforeChange={onBeforeChange} />)
    // Table is no longer inserted from here (DP-06) — a data region is placed
    // by selecting cells and choosing a source in the sheet's own Insert data
    // menu. Text has no data source to choose, so it keeps a panel insert.
    expect(screen.queryByRole('button', { name: 'Add Table region' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add Text / Header region' }))

    const state = useReportStore.getState()
    expect(onBeforeChange).toHaveBeenCalledOnce()
    expect(state.definition.blocks).toHaveLength(1)
    expect(state.definition.blocks[0]).toMatchObject({
      type: 'text',
      sheet_id: 'details',
      layout: { row: 7, col: 2, row_span: 3, col_span: 4 },
    })
    expect(state.selectedBlockId).toBe(state.definition.blocks[0].id)
  })

  it('configures, duplicates, and removes a region without returning to Canvas', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onBeforeChange = vi.fn()
    useReportStore.getState().loadDefinition({
      ...definition,
      blocks: [{
        id: 'heading',
        type: 'text',
        sheet_id: 'overview',
        layout: { row: 1, col: 0, row_span: 1, col_span: 4 },
        config: { text: 'Original heading', level: 'h1' },
      }],
    })

    renderPanel(<WorkbookRegionsPanel onBeforeChange={onBeforeChange} />)
    fireEvent.click(screen.getByRole('button', { name: /text.*heading/i }))
    fireEvent.change(screen.getByPlaceholderText(/report title/i), { target: { value: 'Invoice summary' } })
    expect(useReportStore.getState().definition.blocks[0].config).toMatchObject({ text: 'Invoice summary' })

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate region' }))
    expect(useReportStore.getState().definition.blocks).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Remove region' }))
    expect(useReportStore.getState().definition.blocks).toHaveLength(1)
    expect(window.confirm).toHaveBeenCalledWith('Remove this region from the report?')
    expect(onBeforeChange).toHaveBeenCalledTimes(3)
  })

  it('keeps insertion atomic when no workbook selection is available', () => {
    useReportStore.getState().loadDefinition({ ...definition, blocks: [] })
    renderPanel(<WorkbookRegionsPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Text / Header region' }))
    expect(useReportStore.getState().definition.blocks[0].sheet_id).toBe('overview')

    useReportStore.getState().undo()
    expect(useReportStore.getState().definition.blocks).toHaveLength(0)
  })

  it('snapshots before formatting and does not remove a region when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onBeforeChange = vi.fn()
    renderPanel(<WorkbookRegionsPanel onBeforeChange={onBeforeChange} />)

    fireEvent.click(screen.getByRole('button', { name: /table · pipeline/i }))
    const formatting = screen.getByText('Region formatting').closest('details')!
    fireEvent.click(screen.getByText('Region formatting'))
    fireEvent.click(within(formatting).getAllByRole('button', { name: 'On' })[0])
    expect(useReportStore.getState().definition.blocks[0].style).toMatchObject({ bold: true })
    expect(onBeforeChange).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Remove region' }))
    expect(useReportStore.getState().definition.blocks).toHaveLength(1)
    expect(onBeforeChange).toHaveBeenCalledOnce()
  })

  // Table and group both take a source_id, which only InsertDataMenu's own
  // source-keyed gesture can supply — creating either from here would leave
  // it with no data. Related has no source_id at all (it names a
  // parent/child form pair directly), so InsertDataMenu cannot express it
  // and it keeps a direct insert here, same as text/image.
  it('offers Related Records in the plain Insert grid, but not Table or Group', () => {
    useReportStore.getState().loadDefinition({ ...definition, blocks: [] })
    renderPanel(<WorkbookRegionsPanel />)

    expect(screen.getByRole('button', { name: 'Add Related Records region' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add Table region' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add Group region' })).toBeNull()
  })

  // A selected region's own settings are what an author is actively working
  // on, so they must be reachable without scrolling past the setup/browsing
  // sections (Data sources, Inputs, Insert, Regions) above them — jsdom has
  // no real layout, so DOM order is the assertable proxy: in a top-to-bottom
  // scrollable panel, appearing earlier in the DOM means strictly less
  // scrolling to reach.
  it('renders the selected region\'s own settings before Data sources, not after', () => {
    renderPanel(<WorkbookRegionsPanel />)

    fireEvent.click(screen.getByRole('button', { name: /table · pipeline/i }))

    const detail = screen.getByLabelText('Selected region settings')
    const dataSourcesHeading = screen.getByText('Data sources')
    expect(detail.compareDocumentPosition(dataSourcesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('creates a Related Records region from the plain Insert grid', () => {
    useReportStore.getState().loadDefinition({ ...definition, blocks: [] })
    const onBeforeChange = vi.fn()
    renderPanel(<WorkbookRegionsPanel onBeforeChange={onBeforeChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Related Records region' }))

    const state = useReportStore.getState()
    expect(state.definition.blocks).toHaveLength(1)
    expect(state.definition.blocks[0].type).toBe('related')
    expect(onBeforeChange).toHaveBeenCalledOnce()
  })
})

// DataSourcesSection (rendered inside the panel) calls useTranslation, which
// throws outside an I18nProvider ancestor — real provider, no props, same as
// InsertDataMenu.test.tsx.
function renderPanel(panel: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><I18nProvider>{panel}</I18nProvider></QueryClientProvider>)
}
