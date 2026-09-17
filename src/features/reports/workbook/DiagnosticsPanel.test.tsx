// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import type { InspectResult } from '../api'
import type { ReportBlockRegion, ReportDefinition } from '../types'

const inspectMock = vi.fn()
vi.mock('../api', () => ({
  reportsApi: { inspect: (...args: unknown[]) => inspectMock(...args) },
}))

afterEach(cleanup)

beforeEach(() => {
  inspectMock.mockReset()
})

function definition(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return {
    version: 2,
    name: 'Acme Invoice',
    blocks: [{ id: 'b1', type: 'text', layout: { row: 0, col: 0, row_span: 1, col_span: 4 }, config: { text: 'hi' } }],
    visibility: { mode: 'public' },
    settings: {},
    ...overrides,
  } as unknown as ReportDefinition
}

function inspectResult(overrides: Partial<InspectResult> = {}): InspectResult {
  return {
    format: 'pdf',
    grid_diagnostics: true,
    sheets: [],
    ...overrides,
  }
}

function renderPanel(
  def: ReportDefinition,
  opts: { getDefinition?: () => ReportDefinition; onFocusRegion?: (r: ReportBlockRegion) => void } = {},
) {
  const onFocusRegion = opts.onFocusRegion ?? vi.fn()
  const getDefinition = opts.getDefinition ?? (() => def)
  const view = render(
    <I18nProvider>
      <DiagnosticsPanel definition={def} getDefinition={getDefinition} onFocusRegion={onFocusRegion} />
    </I18nProvider>,
  )
  return { ...view, onFocusRegion }
}

describe('DiagnosticsPanel — nothing happens before Run diagnostics', () => {
  it('does not fetch on mount, and shows an empty state', () => {
    renderPanel(definition())
    expect(inspectMock).not.toHaveBeenCalled()
    expect(screen.getByText('No diagnostics run yet')).toBeTruthy()
  })

  it('skips running when the report has nothing to check', () => {
    renderPanel(definition({ blocks: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    expect(inspectMock).not.toHaveBeenCalled()
    expect(screen.getByText('No diagnostics run yet')).toBeTruthy()
  })
})

describe('DiagnosticsPanel — every generation trigger reads getDefinition() fresh (RF-304)', () => {
  // Same hazard ReportPreviewPanel.test.tsx pins for open()/handleRefresh()/
  // handleFormatChange(): a click handler can flush a store update and
  // trigger a run in the same synchronous call stack, before React commits
  // this component's own `definition` prop update — so every trigger below
  // must call getDefinition() fresh rather than close over the stale prop.
  it('the initial run generates against getDefinition(), not the stale definition prop', async () => {
    inspectMock.mockResolvedValue(inspectResult())
    const stale = definition()
    const fresh = definition({ name: 'Fresh from the store' })
    renderPanel(stale, { getDefinition: () => fresh })

    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))

    await waitFor(() => expect(inspectMock).toHaveBeenCalledTimes(1))
    expect(inspectMock).toHaveBeenCalledWith(fresh, 'pdf', undefined, expect.anything())
  })

  it('Re-run diagnostics generates against getDefinition(), not the stale definition prop', async () => {
    inspectMock.mockResolvedValue(inspectResult())
    const stale = definition()
    const fresh = definition({ name: 'Fresh from the store' })
    renderPanel(stale, { getDefinition: () => fresh })

    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(screen.getByText('No issues found.')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Re-run diagnostics' }))

    await waitFor(() => expect(inspectMock).toHaveBeenCalledTimes(2))
    expect(inspectMock).toHaveBeenNthCalledWith(2, fresh, 'pdf', undefined, expect.anything())
  })
})

describe('DiagnosticsPanel — results', () => {
  it('groups diagnostics by severity with counts, most severe first', async () => {
    inspectMock.mockResolvedValue(inspectResult({
      sheets: [{
        id: 's1', name: 'Sheet 1', row_count: 10, col_count: 10, elements: [],
        diagnostics: [
          { kind: 'spill', severity: 'info', message: 'Charges spilled from 2 to 6 rows.', sheet_id: 's1' },
          { kind: 'overlap', severity: 'warning', message: 'Two elements overlap at row 2, col 3.', sheet_id: 's1' },
          { kind: 'formula_error', severity: 'error', message: 'Formula =NOTAREALFUNCTION() failed.', sheet_id: 's1' },
        ],
      }],
    }))
    renderPanel(definition())

    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))

    await waitFor(() => expect(screen.getByText('Errors · 1')).toBeTruthy())
    expect(screen.getByText('Warnings · 1')).toBeTruthy()
    expect(screen.getByText('Info · 1')).toBeTruthy()
    expect(screen.getByText('Formula =NOTAREALFUNCTION() failed.')).toBeTruthy()

    // "Most severe first": SEVERITY_ORDER drives this, and getAllByText
    // returns matches in DOM order, so this actually pins the ordering
    // rather than just each header's independent presence.
    const headers = screen.getAllByText(/^(Errors|Warnings|Info) · \d+$/).map((el) => el.textContent)
    expect(headers).toEqual(['Errors · 1', 'Warnings · 1', 'Info · 1'])
  })

  it('shows "No issues found" when the run comes back clean', async () => {
    inspectMock.mockResolvedValue(inspectResult())
    renderPanel(definition())
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(screen.getByText('No issues found.')).toBeTruthy())
  })

  it('clicking a located diagnostic focuses it on the workbook surface', async () => {
    inspectMock.mockResolvedValue(inspectResult({
      sheets: [{
        id: 'charges', name: 'Charges', row_count: 10, col_count: 10, elements: [],
        diagnostics: [{
          kind: 'overlap', severity: 'warning', message: 'Two elements overlap.',
          sheet_id: 'charges', location: { row: 2, col: 3, row_span: 1, col_span: 1 },
        }],
      }],
    }))
    const { onFocusRegion } = renderPanel(definition())
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(screen.getByText('Two elements overlap.')).toBeTruthy())

    fireEvent.click(screen.getByText('Two elements overlap.').closest('button')!)

    expect(onFocusRegion).toHaveBeenCalledWith({
      sheet_id: 'charges',
      layout: { row: 2, col: 3, row_span: 1, col_span: 1 },
    })
  })

  it('does not focus (and disables) a diagnostic with no location', async () => {
    inspectMock.mockResolvedValue(inspectResult({
      sheets: [{
        id: 's1', name: 'Sheet 1', row_count: 10, col_count: 10, elements: [],
        diagnostics: [{ kind: 'formula_error', severity: 'error', message: 'Unlocated finding.', sheet_id: 's1' }],
      }],
    }))
    const { onFocusRegion } = renderPanel(definition())
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(screen.getByText('Unlocated finding.')).toBeTruthy())

    const row = screen.getByText('Unlocated finding.').closest('button')! as HTMLButtonElement
    expect(row.disabled).toBe(true)
    fireEvent.click(row)
    expect(onFocusRegion).not.toHaveBeenCalled()
  })

  it('shows the grid-diagnostics note but still lists the diagnostics that did run for this format', async () => {
    inspectMock.mockResolvedValue(inspectResult({
      grid_diagnostics: false,
      grid_diagnostics_note: 'xlsx does not render through the shared positioned grid.',
      sheets: [{
        id: 's1', name: 'Sheet 1', row_count: 10, col_count: 10, elements: [],
        diagnostics: [{ kind: 'formula_error', severity: 'error', message: 'Formula failed.', sheet_id: 's1' }],
      }],
    }))
    renderPanel(definition())
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))

    await waitFor(() => expect(screen.getByText(/does not render through the shared positioned grid/)).toBeTruthy())
    expect(screen.getByText('Formula failed.')).toBeTruthy()
  })
})

describe('DiagnosticsPanel — argument gating', () => {
  it('prompts for a required argument before running, then runs with the confirmed values', async () => {
    inspectMock.mockResolvedValue(inspectResult())
    const def = definition({ arguments: [{ key: 'region', label: 'Region', type: 'text', required: true }] })
    renderPanel(def)

    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    expect(inspectMock).not.toHaveBeenCalled()
    expect(screen.getByText('Region')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'west' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(inspectMock).toHaveBeenCalledTimes(1))
    expect(inspectMock).toHaveBeenCalledWith(def, 'pdf', { region: 'west' }, expect.anything())
  })

  // The single Run/Re-run button combines trigger and gate (unlike
  // PreviewButton, which owns the gate for a SEPARATE always-mounted
  // panel) — so it has to re-check on every click, not just the first, or
  // a required argument added after a successful run would send Re-run's
  // request with no value for it instead of prompting.
  it('re-run reopens the argument dialog when a required argument appears after the initial run', async () => {
    inspectMock.mockResolvedValue(inspectResult())
    const def = definition()
    const { rerender } = renderPanel(def)
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(inspectMock).toHaveBeenCalledTimes(1))

    const withArg = definition({ arguments: [{ key: 'region', label: 'Region', type: 'text', required: true }] })
    rerender(
      <I18nProvider>
        <DiagnosticsPanel definition={withArg} getDefinition={() => withArg} onFocusRegion={vi.fn()} />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Re-run diagnostics' }))
    expect(inspectMock).toHaveBeenCalledTimes(1) // still 1 — waiting on the prompt, not sent with a missing value
    expect(screen.getByText('Region')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'west' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(inspectMock).toHaveBeenCalledTimes(2))
    expect(inspectMock).toHaveBeenNthCalledWith(2, withArg, 'pdf', { region: 'west' }, expect.anything())
  })
})

describe('DiagnosticsPanel — staleness and refresh (RF-303-derived)', () => {
  it('marks results stale when the definition changes after a successful run, without refetching', async () => {
    inspectMock.mockResolvedValue(inspectResult())
    const def = definition()
    const { rerender } = renderPanel(def)
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(screen.getByText('No issues found.')).toBeTruthy())
    expect(inspectMock).toHaveBeenCalledTimes(1)

    const edited = definition({ name: 'Acme Invoice (edited)' })
    rerender(
      <I18nProvider>
        <DiagnosticsPanel definition={edited} getDefinition={() => edited} onFocusRegion={vi.fn()} />
      </I18nProvider>,
    )

    expect(screen.getByText('Out of date')).toBeTruthy()
    expect(inspectMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('No issues found.')).toBeTruthy()
  })

  it('keeps the last successful results visible, clearly marked, after a failed refresh', async () => {
    inspectMock
      .mockResolvedValueOnce(inspectResult())
      .mockRejectedValueOnce(new Error('temporary inspect failure'))
    renderPanel(definition())
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
    await waitFor(() => expect(screen.getByText('No issues found.')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Re-run diagnostics' }))

    await waitFor(() => expect(screen.getByText(/Couldn't refresh/i)).toBeTruthy())
    expect(screen.getByText('No issues found.')).toBeTruthy()
  })
})
