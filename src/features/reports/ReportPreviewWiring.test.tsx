// @vitest-environment jsdom
//
// PreviewButton.test.tsx and ReportPreviewPanel.test.tsx each cover their
// own half of RF-303's split (button → onPreview call; panel → renders on
// open()) in isolation. Neither exercises the ref wire between them — the
// same `previewPanelRef.current?.open(argumentValues)` glue
// ReportBuilderPage.tsx actually wires, which has no dedicated page test.
// A misspelled prop or an unattached ref would leave both of those files
// green while clicking Preview does nothing in the real app. This file
// renders both components together, wired exactly as the page wires them,
// so that specific failure mode has a test.
import { useRef } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { PreviewButton } from './PreviewButton'
import { ReportPreviewPanel } from './ReportPreviewPanel'
import type { ReportPreviewPanelHandle } from './ReportPreviewPanel'
import { useReportStore } from './store'
import { emptyReportDefinition } from './types'
import type { ReportDefinition } from './types'

const previewMock = vi.fn()
vi.mock('./api', () => ({
  reportsApi: { preview: (...args: unknown[]) => previewMock(...args) },
}))

afterEach(cleanup)

beforeEach(() => {
  previewMock.mockReset()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  globalThis.URL.revokeObjectURL = vi.fn()
  useReportStore.getState().reset()
})

function textBlob(body: string): Blob {
  const blob = new Blob([body])
  Object.defineProperty(blob, 'text', { value: async () => body })
  return blob
}

function withOneBlock(base: ReportDefinition): ReportDefinition {
  return {
    ...base,
    blocks: [{ id: 'b1', type: 'text', layout: { row: 0, col: 0, row_span: 1, col_span: 4 }, config: { text: 'hi' } }],
  }
}

// The exact glue ReportBuilderPage.tsx wires: a ref shared between the
// button's onPreview and the panel's imperative open() handle.
function PreviewHarness({ definition }: { definition: ReportDefinition }) {
  const previewPanelRef = useRef<ReportPreviewPanelHandle>(null)
  return (
    <>
      <PreviewButton onPreview={(argumentValues) => previewPanelRef.current?.open(argumentValues)} />
      <ReportPreviewPanel ref={previewPanelRef} definition={definition} />
    </>
  )
}

describe('PreviewButton + ReportPreviewPanel — wired the way ReportBuilderPage wires them', () => {
  it('clicking Preview expands the panel and renders the generated PDF', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF-1.4'), filename: 'a.pdf', rowCount: 2 })
    const definition = withOneBlock(emptyReportDefinition('R'))
    useReportStore.getState().loadDefinition(definition)

    render(
      <I18nProvider>
        <PreviewHarness definition={definition} />
      </I18nProvider>,
    )

    expect(previewMock).not.toHaveBeenCalled()
    // Exact match: the panel's own collapse toggle also has an accessible
    // name containing "preview" ("Expand preview"/"Collapse preview"), so a
    // loose /preview/i regex here would match two buttons.
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(previewMock).toHaveBeenCalledWith(definition, 'pdf', undefined, expect.any(AbortSignal))
  })
})
