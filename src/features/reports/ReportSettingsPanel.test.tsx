// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { useReportStore } from './store'
import { ReportSettingsPanel } from './ReportSettingsPanel'

// ReportSettingsPanel (and the ReportVisibilityEditor/StyleEditor it renders)
// calls useTranslation, which throws outside an I18nProvider ancestor — real
// provider, no props, same pattern as InsertDataMenu.test.tsx. QueryClient is
// needed too: switching ReportVisibilityEditor to specific_roles mounts
// RoleMultiSelect, which calls useRoles (useQuery) — same pattern as
// ExecutionLogsPanel.test.tsx.
function renderPanel(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><I18nProvider>{ui}</I18nProvider></QueryClientProvider>)
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

  // C-5 (docs/report-builder-improvement-plan.md): the live Univer canvas is
  // never rebuilt from the definition on cell changes, so EVERY mutation
  // this panel triggers must flush it first via onBeforeChange, or a
  // panel edit silently discards whatever cell edits the author just made.
  // The test above only exercised one of this panel's several triggers
  // (toggleFormat); this covers the rest so a future trigger added to this
  // same panel without routing through changeSettings fails loudly here
  // rather than shipping a data-loss bug.
  it('flushes onBeforeChange for every mutation this panel can trigger', () => {
    const onBeforeChange = vi.fn()
    renderPanel(<ReportSettingsPanel onBeforeChange={onBeforeChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Report settings' }))

    // visibility (ReportVisibilityEditor's mode SelectMenu — the first of
    // several comboboxes this panel renders once open, in DOM/JSX order:
    // Visibility, then Default format).
    fireEvent.click(screen.getAllByRole('combobox')[0])
    fireEvent.click(screen.getByRole('option', { name: 'Specific roles' }))
    expect(onBeforeChange).toHaveBeenCalledTimes(1)

    // default_format (PDF is not in this fixture's allowed_formats, so
    // picking it also exercises the "grow allowed_formats" branch).
    fireEvent.click(screen.getAllByRole('combobox')[1])
    fireEvent.click(screen.getByRole('option', { name: 'PDF' }))
    expect(onBeforeChange).toHaveBeenCalledTimes(2)

    // style_defaults (StyleEditor's border-width input — a plain number
    // input, unambiguous unlike the tri-state Bold/Italic "On" buttons or
    // the Align SelectMenu, both of which repeat across this editor).
    fireEvent.change(screen.getByPlaceholderText('Width'), { target: { value: '2' } })
    expect(onBeforeChange).toHaveBeenCalledTimes(3)
  })
})
