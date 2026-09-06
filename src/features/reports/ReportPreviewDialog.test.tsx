// @vitest-environment jsdom
//
// The preview dialog's whole promise is that what you see IS the file you
// would download, so what matters per format is which renderer it reaches
// for: the browser's own PDF viewer (an <iframe> over a blob: URL — the
// app's CSP allows blob: under frame-src but sets object-src 'none', so an
// <object>/<embed> would be silently blocked), plain text printed as-is, or
// an honest "your browser cannot show this one" state. A regression in that
// mapping is invisible in a screenshot of the happy path, which is why it is
// pinned here rather than only checked by hand.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ReportPreviewDialog } from './ReportPreviewDialog'
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

function renderDialog(format: ExportFormat) {
  return render(
    <I18nProvider>
      <ReportPreviewDialog open onClose={() => {}} definition={definition(format)} />
    </I18nProvider>,
  )
}

describe('ReportPreviewDialog', () => {
  it('shows a PDF in an iframe over a blob URL, never an object/embed', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF-1.4'), filename: 'acme.pdf', rowCount: 3 })
    renderDialog('pdf')

    // Radix renders the dialog through a portal, so these live on document.body,
    // not inside RTL's own container element.
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
    renderDialog('markdown')

    await waitFor(() => expect(document.querySelector('pre')).not.toBeNull())
    expect(document.querySelector('pre')?.textContent).toContain('7700')
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('says so honestly for a format the browser cannot render, and offers PDF instead', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('PK'), filename: 'acme.xlsx', rowCount: 4 })
    renderDialog('xlsx')

    await waitFor(() => expect(screen.getByText(/open in a spreadsheet or word processor/i)).toBeTruthy())
    // Deliberately NOT a re-rendered approximation: no fake grid, no iframe
    // pretending to be the spreadsheet.
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByText(/Download to view/i)).toBeTruthy()
    expect(screen.getByText(/View as PDF/i)).toBeTruthy()
  })

  it('surfaces a generation failure as an error, not an empty frame', async () => {
    previewMock.mockRejectedValue(new Error('block "charges" has unknown type'))
    renderDialog('pdf')

    await waitFor(() => expect(screen.getByText(/Couldn't generate this report/i)).toBeTruthy())
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('reports the row count the server sent, singular included', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 1 })
    renderDialog('pdf')
    // Pins that the {{count}} placeholder is really interpolated: the first
    // version of this shipped with a single-brace token and rendered the
    // literal text "{count} rows" on screen.
    await waitFor(() => expect(screen.getByText('1 row')).toBeTruthy())
  })

  it('interpolates a plural row count instead of printing the placeholder', async () => {
    previewMock.mockResolvedValue({ blob: textBlob('%PDF'), filename: 'a.pdf', rowCount: 42 })
    renderDialog('pdf')
    await waitFor(() => expect(screen.getByText('42 rows')).toBeTruthy())
  })
})
