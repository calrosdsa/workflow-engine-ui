// @vitest-environment jsdom
//
// Group (subtotals) was registered, backend-complete and ConfigPanel-
// complete, but had NO creation path at all: the Insert grid filtered data
// blocks out (WorkbookRegionsPanel.tsx) and this menu hardcoded 'table' on
// every insert. This pins the fix — a type toggle that changes what
// insert() creates — and, just as importantly, that the DEFAULT stays
// 'table': every existing report's muscle memory (pick a source, get a
// table) must keep working unchanged for an author who never touches the
// toggle.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import '@/features/reports/blocks'
import { InsertDataMenu } from './InsertDataMenu'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { useReportStore } from '../store'
import { emptyReportDefinition } from '../types'
import type { ReportDataSource } from '../types'

// The type toggle calls useTranslation, which throws outside an
// I18nProvider ancestor — real provider, no props, exercises the actual
// en.ts strings ('Table'/'Subtotals') rather than a mocked t().
function renderMenu(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

vi.mock('@/features/forms/hooks', () => ({
  useForms: () => ({ data: [{ id: 'form-1', name: 'Invoices' }] }),
}))

afterEach(cleanup)

// Radix DropdownMenu leans on browser APIs jsdom doesn't implement — same
// stub set combobox-aria.test.tsx already established for exactly this
// Radix-in-jsdom gap.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

const source: ReportDataSource = { id: 'src-1', name: 'Invoices', form_id: 'form-1' }
const selection = { sheet_id: 's1', layout: { row: 0, col: 0, row_span: 1, col_span: 4 } }

function seedWithSource() {
  useReportStore.getState().loadDefinition({
    ...emptyReportDefinition('R'),
    version: 2,
    data_sources: [source],
    workbook: { sheets: [{ id: 's1', name: 'Sheet', row_count: 10, column_count: 10 }] },
  })
}

async function openMenu() {
  // Radix DropdownMenu's trigger opens on pointerdown, not click — jsdom's
  // fireEvent.click never synthesizes the intermediate pointer event a real
  // browser click produces, so this dispatches it explicitly. No existing
  // test in this codebase opens a Radix DropdownMenu; this establishes the
  // pattern (mirrors combobox-aria.test.tsx's own precedent for the
  // analogous Radix Select gap).
  const trigger = screen.getByRole('button', { name: /insert data/i })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(trigger)
  await screen.findByText('Invoices')
}

describe('InsertDataMenu — table/group type toggle', () => {
  it('creates a table block by default, unchanged from before the toggle existed', async () => {
    seedWithSource()
    renderMenu(<InsertDataMenu getSelection={() => selection} />)
    await openMenu()

    fireEvent.click(screen.getByText('Invoices'))

    const blocks = useReportStore.getState().definition.blocks
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('table')
  })

  it('creates a group block once Subtotals is selected', async () => {
    seedWithSource()
    renderMenu(<InsertDataMenu getSelection={() => selection} />)
    await openMenu()

    fireEvent.click(screen.getByText('Subtotals'))
    fireEvent.click(screen.getByText('Invoices'))

    const blocks = useReportStore.getState().definition.blocks
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('group')
  })

  // The bug the sequencing critique named directly: a group block created
  // here must keep its source_id through the editor's own defensive parse,
  // or it falls back to form_id: '' and cannot generate at all. Regression-
  // tested at the schema layer already (config-round-trip.test.ts); this
  // confirms the STORED value this menu writes is what that layer expects.
  it('sets source_id on the group block it creates, not form_id', async () => {
    seedWithSource()
    renderMenu(<InsertDataMenu getSelection={() => selection} />)
    await openMenu()

    fireEvent.click(screen.getByText('Subtotals'))
    fireEvent.click(screen.getByText('Invoices'))

    const config = useReportStore.getState().definition.blocks[0].config as { source_id?: string }
    expect(config.source_id).toBe('src-1')
  })

  it('remembers the chosen type across a second insert in the same menu session', async () => {
    seedWithSource()
    renderMenu(<InsertDataMenu getSelection={() => selection} />)
    await openMenu()
    fireEvent.click(screen.getByText('Subtotals'))
    fireEvent.click(screen.getByText('Invoices'))

    await openMenu()
    fireEvent.click(screen.getByText('Invoices'))

    const blocks = useReportStore.getState().definition.blocks
    expect(blocks).toHaveLength(2)
    expect(blocks[1].type).toBe('group')
  })

  it('does not close the menu when the type toggle itself is clicked', async () => {
    seedWithSource()
    renderMenu(<InsertDataMenu getSelection={() => selection} />)
    await openMenu()

    fireEvent.click(screen.getByText('Subtotals'))
    expect(screen.getByText('Invoices')).toBeTruthy()
  })
})
