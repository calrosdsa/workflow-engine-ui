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
// button's onPreview and the panel's imperative open() handle, PLUS
// PreviewButton's onBeforeChange and the panel's own getDefinition — both
// flush-then-read the store rather than trusting a React prop, which is
// what the RF-304 staleness regression below pins.
function PreviewHarness({ definition, onBeforeChange }: { definition: ReportDefinition; onBeforeChange?: () => void }) {
  const previewPanelRef = useRef<ReportPreviewPanelHandle>(null)
  return (
    <>
      <PreviewButton onBeforeChange={onBeforeChange} onPreview={(argumentValues) => previewPanelRef.current?.open(argumentValues)} />
      <ReportPreviewPanel ref={previewPanelRef} definition={definition} getDefinition={() => useReportStore.getState().definition} />
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

  // RF-304 regression: PreviewButton.handlePreview calls onBeforeChange()
  // (flushing a live canvas edit into the store) and then, still inside the
  // SAME synchronous click handler, calls onPreview() -> panel.open(). React
  // defers the panel's `definition` PROP update until after the handler
  // returns, even though Zustand's setState already updated the store
  // synchronously — so open() must read the store itself (via getDefinition)
  // rather than trust the definition prop closed over at the last render.
  // An earlier version of ReportPreviewPanel did the latter and silently
  // dropped whatever onBeforeChange had just flushed from every preview.
  it('picks up a store change flushed by onBeforeChange within the same click, even though the definition prop has not re-rendered yet', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF-1.4'), filename: 'a.pdf', rowCount: 2 })
    const initial = withOneBlock(emptyReportDefinition('R'))
    useReportStore.getState().loadDefinition(initial)

    render(
      <I18nProvider>
        <PreviewHarness
          definition={initial}
          onBeforeChange={() => { useReportStore.getState().updateName('Flushed name') }}
        />
      </I18nProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(previewMock).toHaveBeenCalledTimes(1)
    const [sentDefinition] = previewMock.mock.calls[0] as [ReportDefinition]
    // The flushed name must be in the generated definition, not silently
    // dropped because React hadn't re-rendered the panel's `definition`
    // prop yet at the moment open() ran.
    expect(sentDefinition.name).toBe('Flushed name')
  })
})
