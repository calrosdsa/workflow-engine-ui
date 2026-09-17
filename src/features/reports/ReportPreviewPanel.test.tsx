// @vitest-environment jsdom
//
// The panel's whole promise is that what you see IS the file you would
// download, so the format-to-renderer mapping (iframe / <pre> / honest
// "can't show this" fallback) is pinned here rather than only checked by
// hand — same rationale the old ReportPreviewDialog.test.tsx carried,
// which this file replaces following the RF-303 modal→docked-panel
// conversion. The scenarios new to a panel that stays mounted across many
// generations — staleness, cancel-on-supersede, surviving a failed
// refresh, surviving a collapse — are new tests below, not adaptations.
import { createRef } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ReportPreviewPanel } from './ReportPreviewPanel'
import type { ReportPreviewPanelHandle } from './ReportPreviewPanel'
import type { ExportFormat, ReportDefinition } from './types'

const previewMock = vi.fn()
vi.mock('./api', () => ({
  reportsApi: { preview: (...args: unknown[]) => previewMock(...args) },
}))

afterEach(cleanup)

beforeEach(() => {
  previewMock.mockReset()
  // jsdom implements neither, and the component's object-URL lifecycle is
  // load-bearing enough that silently no-oping them would hide a real leak.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  globalThis.URL.revokeObjectURL = vi.fn()
})

// jsdom's Blob has no .text() in this environment, and the component awaits
// it for every text format — so the fake carries a real one.
function textBlob(body: string): Blob {
  const blob = new Blob([body])
  Object.defineProperty(blob, 'text', { value: async () => body })
  return blob
}

function definition(format: ExportFormat): ReportDefinition {
  return {
    version: 2,
    name: 'Acme Invoice',
    blocks: [],
    visibility: { mode: 'public' },
    settings: { default_format: format },
  } as unknown as ReportDefinition
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function renderPanel(def: ReportDefinition) {
  const ref = createRef<ReportPreviewPanelHandle>()
  const view = render(
    <I18nProvider>
      <ReportPreviewPanel ref={ref} definition={def} />
    </I18nProvider>,
  )
  return { ...view, ref }
}

describe('ReportPreviewPanel — nothing happens before open()', () => {
  it('does not fetch on mount, and shows an empty state', () => {
    renderPanel(definition('pdf'))
    expect(previewMock).not.toHaveBeenCalled()
    expect(screen.getByText('No preview yet')).toBeTruthy()
  })
})

describe('ReportPreviewPanel — format rendering', () => {
  it('shows a PDF in an iframe over a blob URL, never an object/embed', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF-1.4'), filename: 'acme.pdf', rowCount: 3 })
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open() })

    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe('blob:mock-url')
    // object-src is 'none' in this app's CSP — either of these would render blank.
    expect(document.querySelector('object')).toBeNull()
    expect(document.querySelector('embed')).toBeNull()
  })

  it('prints a text format as-is rather than downloading it', async () => {
    previewMock.mockResolvedValue({
      blob: textBlob('| A | B |\n| --- | --- |\n| 2400 | 7700 |'),
      filename: 'acme.md',
      rowCount: 1,
    })
    const { ref } = renderPanel(definition('markdown'))
    act(() => { ref.current!.open() })

    await waitFor(() => expect(document.querySelector('pre')).not.toBeNull())
    expect(document.querySelector('pre')?.textContent).toContain('7700')
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('says so honestly for a format the browser cannot render, and offers PDF instead', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('PK'), filename: 'acme.xlsx', rowCount: 4 })
    const { ref } = renderPanel(definition('xlsx'))
    act(() => { ref.current!.open() })

    await waitFor(() => expect(screen.getByText(/open in a spreadsheet or word processor/i)).toBeTruthy())
    // Deliberately NOT a re-rendered approximation: no fake grid, no iframe
    // pretending to be the spreadsheet.
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByText(/Download to view/i)).toBeTruthy()
    expect(screen.getByText(/View as PDF/i)).toBeTruthy()
  })

  it('reports the row count the server sent, singular included', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open() })
    // Pins that the {{count}} placeholder is really interpolated: the first
    // version of the old dialog shipped with a single-brace token and
    // rendered the literal text "{count} rows" on screen.
    await waitFor(() => expect(screen.getByText('1 row')).toBeTruthy())
  })

  it('interpolates a plural row count instead of printing the placeholder', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 42 })
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open() })
    await waitFor(() => expect(screen.getByText('42 rows')).toBeTruthy())
  })
})

describe('ReportPreviewPanel — first-generation failure', () => {
  it('surfaces a generation failure as an error, not an empty frame, when nothing has rendered yet', async () => {
    previewMock.mockRejectedValue(new Error('block "charges" has unknown type'))
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open() })

    await waitFor(() => expect(screen.getByText(/Couldn't generate this report/i)).toBeTruthy())
    expect(document.querySelector('iframe')).toBeNull()
  })
})

describe('ReportPreviewPanel — staleness and refresh (RF-303)', () => {
  it('marks the preview stale when the definition changes after a successful render, without refetching', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
    const def = definition('pdf')
    const { ref, rerender } = renderPanel(def)
    act(() => { ref.current!.open() })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(previewMock).toHaveBeenCalledTimes(1)

    rerender(
      <I18nProvider>
        <ReportPreviewPanel ref={ref} definition={{ ...def, name: 'Acme Invoice (edited)' }} />
      </I18nProvider>,
    )

    expect(screen.getByText('Preview out of date')).toBeTruthy()
    // Editing the sheet must not itself trigger a new request.
    expect(previewMock).toHaveBeenCalledTimes(1)
    // The last successful PDF is still the one on screen.
    expect(document.querySelector('iframe')).not.toBeNull()
  })

  it('keeps the last successful preview visible, clearly marked, after a failed refresh', async () => {
    previewMock
      .mockResolvedValueOnce({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
      .mockRejectedValueOnce(new Error('temporary render failure'))
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open() })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(screen.getByText(/Couldn't refresh/i)).toBeTruthy())
    // Still showing the last successful render, not an empty error frame.
    expect(document.querySelector('iframe')).not.toBeNull()
  })

  it('aborts the superseded request when a new one starts before it resolves', async () => {
    const first = deferred<{ blob: Blob; filename: string; rowCount: number }>()
    const second = deferred<{ blob: Blob; filename: string; rowCount: number }>()
    previewMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { ref } = renderPanel(definition('pdf'))

    act(() => { ref.current!.open() })
    const firstSignal = previewMock.mock.calls[0][3] as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    act(() => { ref.current!.open() })
    expect(firstSignal.aborted).toBe(true)

    await act(async () => {
      second.resolve({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
      await second.promise
    })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())

    // The superseded request resolving late must not clobber the newer one.
    await act(async () => {
      first.resolve({ blob: textBlob('%PDF stale'), filename: 'old.pdf', rowCount: 9 })
      await first.promise.catch(() => {})
    })
    expect(screen.queryByText('9 rows')).toBeNull()
  })
})

describe('ReportPreviewPanel — argument values survive a format switch', () => {
  it('reuses the argument values collected at open() when the format is switched', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open({ region: 'west' }) })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    expect(previewMock).toHaveBeenNthCalledWith(1, expect.anything(), 'pdf', { region: 'west' }, expect.anything())

    fireEvent.click(screen.getByText('PDF'))
    fireEvent.click(screen.getByRole('option', { name: 'Markdown' }))

    await waitFor(() => expect(previewMock).toHaveBeenCalledTimes(2))
    expect(previewMock).toHaveBeenNthCalledWith(2, expect.anything(), 'markdown', { region: 'west' }, expect.anything())
  })
})

describe('ReportPreviewPanel — collapse preserves state', () => {
  it('keeps the rendered PDF mounted (not torn down) when the panel is collapsed and re-expanded', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
    const { ref } = renderPanel(definition('pdf'))
    act(() => { ref.current!.open() })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /collapse preview/i }))
    // Still in the DOM — only visually hidden — so no re-fetch is needed on
    // re-expand and no in-progress edit state is lost by the round trip.
    expect(document.querySelector('iframe')).not.toBeNull()
    expect(previewMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /expand preview/i }))
    expect(document.querySelector('iframe')).not.toBeNull()
    expect(previewMock).toHaveBeenCalledTimes(1)
  })
})
