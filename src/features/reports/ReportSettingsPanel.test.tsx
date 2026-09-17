// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { useReportStore } from './store'
import { ReportSettingsPanel } from './ReportSettingsPanel'

// ReportSettingsPanel (and the ReportVisibilityEditor/StyleEditor/
// PageSetupSection it renders) calls useTranslation, which throws outside
// an I18nProvider ancestor — real provider, no props, same pattern as
// InsertDataMenu.test.tsx. QueryClientProvider is needed as of RF-301:
// PageSetupSection's format-support note calls useRendererCapabilities
// (useQuery), which throws without a QueryClient in scope, same pattern
// WorkbookRegionsPanel.test.tsx already uses for its own useForms() call.
function renderPanel(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><I18nProvider>{ui}</I18nProvider></QueryClientProvider>)
}

describe('ReportSettingsPanel', () => {
  beforeEach(() => useReportStore.getState().loadDefinition({
    version: 2,
    name: 'Invoice report',
    blocks: [],
    workbook: { sheets: [{ id: 'report-layout', name: 'Report layout', row_count: 20, column_count: 8 }] },
    settings: { default_format: 'xlsx', allowed_formats: ['xlsx', 'csv'] },
    visibility: { mode: 'public' },
  }))

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('clears the default when that format is removed from the allowed formats', () => {
    const onBeforeChange = vi.fn()
    renderPanel(<ReportSettingsPanel onBeforeChange={onBeforeChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Report settings' }))
    fireEvent.click(screen.getByText('Excel (.xlsx)', { selector: 'label' }))

    expect(useReportStore.getState().definition.settings).toMatchObject({
      allowed_formats: ['csv'],
      default_format: undefined,
    })
    expect(onBeforeChange).toHaveBeenCalledOnce()
  })
})
