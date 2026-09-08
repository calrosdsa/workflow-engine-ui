// @vitest-environment jsdom
//
// Pins the row-interaction fix: a row previously got `cursor-pointer` +
// hover feedback whenever EITHER onRowClick or onRowDoubleClick was passed,
// but only onDoubleClick was ever wired to fire — RecordsTable.tsx's List
// layout passed onRowDoubleClick alone, so the pointer/hover affordance
// promised a single click that did nothing (found live: the row's own
// quick-preview Drawer was fully built but unreachable by mouse in the
// default table view). Rows also had no tabIndex/onKeyDown at all.
//
// Covers: click and double-click fire their own handler only (not both),
// Enter activates the row (falling back to onRowDoubleClick when
// onRowClick is absent, matching RecordsTable's single-handler callers),
// and a row with neither handler stays non-interactive (KnowledgeBase/
// Roles/Users tables, which pass neither prop).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DataTable, type DataTableColumn } from './data-table'

afterEach(cleanup)

const columns: DataTableColumn[] = [{ key: 'name', label: 'Name' }]
const rows = [{ id: '1', name: 'Acme Corp' }]

describe('DataTable — row click/double-click/keyboard activation', () => {
  it('fires onRowClick on a single click, not onRowDoubleClick', () => {
    const onRowClick = vi.fn()
    const onRowDoubleClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id as string} onRowClick={onRowClick} onRowDoubleClick={onRowDoubleClick} />)

    fireEvent.click(screen.getByText('Acme Corp').closest('tr')!)

    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowDoubleClick).not.toHaveBeenCalled()
  })

  it('fires onRowDoubleClick on a double click', () => {
    const onRowDoubleClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id as string} onRowDoubleClick={onRowDoubleClick} />)

    fireEvent.doubleClick(screen.getByText('Acme Corp').closest('tr')!)

    expect(onRowDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('is a focusable, Enter-activatable row when only onRowClick is passed', () => {
    const onRowClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id as string} onRowClick={onRowClick} />)

    const row = screen.getByText('Acme Corp').closest('tr')!
    expect(row.getAttribute('tabIndex')).toBe('0')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('falls back to onRowDoubleClick on Enter when onRowClick is absent', () => {
    const onRowDoubleClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id as string} onRowDoubleClick={onRowDoubleClick} />)

    fireEvent.keyDown(screen.getByText('Acme Corp').closest('tr')!, { key: 'Enter' })

    expect(onRowDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('stays non-interactive with no tabIndex when neither handler is passed', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id as string} />)

    const row = screen.getByText('Acme Corp').closest('tr')!
    expect(row.getAttribute('tabIndex')).toBeNull()
    expect(row.className).not.toContain('cursor-pointer')
  })

  it('isRowClickable narrows which rows get the activatable styling, without disabling the click handler itself', () => {
    const onRowClick = vi.fn()
    const mixedRows = [{ id: '1', name: 'Clickable' }, { id: '2', name: 'Not clickable' }]
    render(
      <DataTable
        columns={columns}
        rows={mixedRows}
        getRowId={(r) => r.id as string}
        onRowClick={onRowClick}
        isRowClickable={(row) => row.id === '1'}
      />,
    )

    const clickableRow = screen.getByText('Clickable').closest('tr')!
    const nonClickableRow = screen.getByText('Not clickable').closest('tr')!
    expect(clickableRow.getAttribute('tabIndex')).toBe('0')
    expect(clickableRow.className).toContain('cursor-pointer')
    expect(nonClickableRow.getAttribute('tabIndex')).toBeNull()
    expect(nonClickableRow.className).not.toContain('cursor-pointer')

    // The handler itself is still wired on every row — a caller that wants
    // the click to truly no-op on a non-clickable row checks the row inside
    // its own onRowClick, the same way isRowClickable's predicate does.
    fireEvent.click(nonClickableRow)
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
})

describe('DataTable — footer row', () => {
  const twoCols: DataTableColumn[] = [{ key: 'name', label: 'Name' }, { key: 'amount', label: 'Amount' }]

  it('renders no <tfoot> at all when footer is omitted', () => {
    const { container } = render(<DataTable columns={twoCols} rows={rows} getRowId={(r) => r.id as string} />)
    expect(container.querySelector('tfoot')).toBeNull()
  })

  it('renders one footer cell per column, blank for a column absent from the map', () => {
    render(<DataTable columns={twoCols} rows={rows} getRowId={(r) => r.id as string} footer={{ amount: '$100.00' }} />)
    const footerRow = screen.getByText('$100.00').closest('tr')!
    expect(footerRow.parentElement?.tagName).toBe('TFOOT')
    const cells = footerRow.querySelectorAll('td')
    expect(cells).toHaveLength(2)
    expect(cells[0].textContent).toBe('') // "name" absent from footer
    expect(cells[1].textContent).toBe('$100.00')
  })

  it('suppresses the footer while loading, alongside the skeleton rows', () => {
    const { container } = render(<DataTable columns={twoCols} rows={rows} getRowId={(r) => r.id as string} footer={{ amount: '$100.00' }} loading />)
    expect(container.querySelector('tfoot')).toBeNull()
  })
})
