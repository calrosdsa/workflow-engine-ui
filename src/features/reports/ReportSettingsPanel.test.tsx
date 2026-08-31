// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReportStore } from './store'
import { ReportSettingsPanel } from './ReportSettingsPanel'

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
    render(<ReportSettingsPanel onBeforeChange={onBeforeChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Report settings' }))
    fireEvent.click(screen.getByText('Excel (.xlsx)', { selector: 'label' }))

    expect(useReportStore.getState().definition.settings).toMatchObject({
      allowed_formats: ['csv'],
      default_format: undefined,
    })
    expect(onBeforeChange).toHaveBeenCalledOnce()
  })
})
