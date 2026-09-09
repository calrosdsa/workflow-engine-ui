// @vitest-environment jsdom
//
// THE BUG THIS PINS: Preview read `definition` from the store, but a live
// Univer canvas edit does not itself update the store — it only sets
// workbookNeedsSyncRef and waits for the NEXT semantic mutation (adding a
// block, changing a setting) to flush it in. ReportSettingsPanel,
// UniverWorkbookSurface and WorkbookRegionsPanel all receive an
// onBeforeChange prop wired to that flush; PreviewButton received nothing,
// so clicking Preview could render everything except whatever was just
// typed into the grid — the one render path that is supposed to be
// byte-truthful, fed stale input.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { PreviewButton } from './PreviewButton'
import { useReportStore } from './store'
import { emptyReportDefinition } from './types'
import type { ReportDefinition, ReportArgument } from './types'

const previewMock = vi.fn()
vi.mock('./api', () => ({
  reportsApi: { preview: (...args: unknown[]) => previewMock(...args) },
}))

// sonner renders nothing without a mounted <Toaster/>, so the only way to
// assert "no error toast fired" (as opposed to "no visible DOM changed") is
// to spy on the calls directly.
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), loading: vi.fn(), success: vi.fn() },
}))

afterEach(cleanup)

beforeEach(() => {
  previewMock.mockReset()
  toastError.mockReset()
  // Never resolves within these tests — nothing here asserts on the
  // rendered PREVIEW CONTENT, only on whether the dialog opened at all, so
  // an in-flight promise is a feature: it keeps the dialog in its loading
  // state instead of racing a real render.
  previewMock.mockReturnValue(new Promise(() => {}))
  useReportStore.getState().reset()
})

function renderButton(onBeforeChange?: () => void) {
  return render(
    <I18nProvider>
      <PreviewButton onBeforeChange={onBeforeChange} />
    </I18nProvider>,
  )
}

function withOneBlock(base: ReportDefinition): ReportDefinition {
  return {
    ...base,
    blocks: [{ id: 'b1', type: 'text', layout: { row: 0, col: 0, row_span: 1, col_span: 4 }, config: { text: 'hi' } }],
  }
}

describe('PreviewButton — flushing the canvas before reading the store', () => {
  it('calls onBeforeChange exactly once per click', () => {
    useReportStore.getState().loadDefinition(withOneBlock(emptyReportDefinition('R')))
    const onBeforeChange = vi.fn()
    renderButton(onBeforeChange)

    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    expect(onBeforeChange).toHaveBeenCalledTimes(1)
  })

  // The exact scenario the bug produced: content exists only because a
  // flush is ABOUT to land it, simulating a live canvas edit
  // (workbookNeedsSyncRef true) that onBeforeChange resolves into the store
  // — Preview must see it, not the empty definition captured at render time.
  it('opens the preview using content the flush JUST added, not the pre-flush empty definition', () => {
    useReportStore.getState().loadDefinition(emptyReportDefinition('R'))
    const onBeforeChange = () => {
      useReportStore.getState().loadDefinition(withOneBlock(emptyReportDefinition('R')))
    }
    renderButton(onBeforeChange)

    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    expect(toastError).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  // Same hazard, one layer earlier: a required argument the flush just
  // added must gate the prompt dialog, not be missed because the argument
  // list was computed from the pre-flush definition.
  it('prompts for an argument the flush JUST added, instead of skipping straight to preview', () => {
    useReportStore.getState().loadDefinition(withOneBlock(emptyReportDefinition('R')))
    const argumentList: ReportArgument[] = [{ key: 'region', label: 'Region', type: 'text', required: true }]
    const onBeforeChange = () => {
      useReportStore.getState().loadDefinition({
        ...withOneBlock(emptyReportDefinition('R')),
        arguments: argumentList,
      })
    }
    renderButton(onBeforeChange)

    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    expect(screen.getByText('Region')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: /region/i })).toBeNull()
  })

  it('still shows the empty-report error when the flush adds nothing', () => {
    useReportStore.getState().loadDefinition(emptyReportDefinition('R'))
    const onBeforeChange = vi.fn() // called, but the store stays empty
    renderButton(onBeforeChange)

    fireEvent.click(screen.getByRole('button', { name: /preview/i }))

    expect(onBeforeChange).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith(
      'Add a block before previewing',
      expect.objectContaining({ description: expect.any(String) }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('works with no onBeforeChange at all (optional prop, no crash)', () => {
    useReportStore.getState().loadDefinition(withOneBlock(emptyReportDefinition('R')))
    renderButton(undefined)

    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
