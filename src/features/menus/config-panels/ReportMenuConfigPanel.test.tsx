// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ReportMenuConfigPanel } from './ReportMenuConfigPanel'
import { useReports } from '@/features/reports/hooks'
import { emptyReportDefinition } from '@/features/reports/types'
import type { ReportDefinitionRow, ReportArgument } from '@/features/reports/types'
import type { Menu, ReportMenuConfig } from '../types'

afterEach(cleanup)

vi.mock('@/features/reports/hooks', () => ({
  useReports: vi.fn(),
}))

// I18nProvider ancestor — real provider, no props, same pattern as
// features/reports/blocks/related/ConfigPanel.test.tsx.
function renderPanel(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function menu(reportDefinitionId: string): Menu {
  return {
    id: 'm-1', app_id: 'a-1', parent_id: null, menu_type: 'report', slug: 'sales-report', name: 'Sales Report',
    sort_order: 0, config: { report_definition_id: reportDefinitionId } satisfies ReportMenuConfig,
    permission_mode: 'all', required_role_ids: [], hidden_from_nav: false, created_at: '', updated_at: '',
  }
}

describe('ReportMenuConfigPanel', () => {
  it('shows the empty state when no reports exist yet', () => {
    vi.mocked(useReports).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useReports>)
    renderPanel(<ReportMenuConfigPanel menu={menu('')} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText(/no reports yet/i)).toBeTruthy()
  })

  it('calls onChange with the selected report_definition_id', () => {
    const reports: ReportDefinitionRow[] = [
      { id: 'rep-1', name: 'Sales Report', definition: emptyReportDefinition('Sales Report'), created_at: '', updated_at: '' },
      { id: 'rep-2', name: 'Inventory Report', definition: emptyReportDefinition('Inventory Report'), created_at: '', updated_at: '' },
    ]
    vi.mocked(useReports).mockReturnValue({ data: reports } as unknown as ReturnType<typeof useReports>)
    const onChange = vi.fn()
    renderPanel(<ReportMenuConfigPanel menu={menu('')} onChange={onChange} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Inventory Report'))

    expect(onChange).toHaveBeenCalledWith({ report_definition_id: 'rep-2' })
  })

  it('shows a block/argument summary once a report is selected', () => {
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text' }]
    const def = {
      ...emptyReportDefinition('Sales Report'),
      arguments: argumentList,
      blocks: [{ id: 'b1', type: 'text', config: {}, layout: { row: 0, col: 0, row_span: 1, col_span: 1 } }],
    }
    const reports: ReportDefinitionRow[] = [{ id: 'rep-1', name: 'Sales Report', definition: def, created_at: '', updated_at: '' }]
    vi.mocked(useReports).mockReturnValue({ data: reports } as unknown as ReturnType<typeof useReports>)

    renderPanel(<ReportMenuConfigPanel menu={menu('rep-1')} onChange={vi.fn()} />)
    expect(screen.getByText(/1 block/i)).toBeTruthy()
    expect(screen.getByText(/1 filter/i)).toBeTruthy()
  })
})
