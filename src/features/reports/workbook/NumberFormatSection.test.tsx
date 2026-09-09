// @vitest-environment jsdom
//
// THE BUG THIS PINS: read() and apply() both resolve to Univer's own
// "active range", which — unlike a genuine drag-selection — is effectively
// always present once any cell has ever had focus. So clicking "Format
// selected cells" with nothing deliberately selected did not fail loudly;
// it silently formatted whatever cell happened to be the last-focused one.
// InsertDataMenu's own insert() already states the governing principle for
// this exact situation: "Not silently disabled: the control stays live and
// says what is missing, since 'nothing happened' is the worst possible
// response." This component contradicted it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { NumberFormatSection } from './NumberFormatSection'
import type { ReportBlockRegion } from '../types'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}))

afterEach(cleanup)

function renderSection(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

const someSelection: ReportBlockRegion = {
  sheet_id: 's1',
  layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
}

describe('NumberFormatSection — gated on a real selection', () => {
  it('refuses to open, with an explanatory error, when getSelection reports nothing selected', () => {
    toastError.mockReset()
    const read = vi.fn()
    const apply = vi.fn()
    renderSection(<NumberFormatSection read={read} apply={apply} getSelection={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: /format selected cells/i }))

    expect(toastError).toHaveBeenCalledWith('Select the cells to format first.')
    expect(read).not.toHaveBeenCalled()
    // Still collapsed — the format fields never rendered.
    expect(screen.queryByText('Style')).toBeNull()
  })

  it('opens normally when getSelection reports a real selection', () => {
    toastError.mockReset()
    const read = vi.fn(() => undefined)
    const apply = vi.fn()
    renderSection(<NumberFormatSection read={read} apply={apply} getSelection={() => someSelection} />)

    fireEvent.click(screen.getByRole('button', { name: /format selected cells/i }))

    expect(toastError).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledOnce()
    expect(screen.getByText('Style')).toBeTruthy()
  })

  // getSelection is optional. The ONE other thing this component could be
  // used for (a plain value/onChange form field, unrelated to a sheet
  // selection at all) must keep behaving exactly as it did before this
  // fix — no caller that never wires getSelection should ever see the new
  // gate at all.
  it('always opens when getSelection is not provided at all (backward compatible)', () => {
    toastError.mockReset()
    const read = vi.fn(() => undefined)
    const apply = vi.fn()
    renderSection(<NumberFormatSection read={read} apply={apply} />)

    fireEvent.click(screen.getByRole('button', { name: /format selected cells/i }))

    expect(toastError).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledOnce()
    expect(screen.getByText('Style')).toBeTruthy()
  })
})
