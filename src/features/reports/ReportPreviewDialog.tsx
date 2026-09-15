// The report builder's on-screen preview.
//
// WHY THIS SHOWS THE SERVER'S REAL FILE BYTES, NOT A CLIENT-SIDE RE-RENDER
// -----------------------------------------------------------------------
// The obvious alternative was to render the workbook client-side (a
// read-only Univer instance, or an HTML table built from the definition).
// That would look better and be wrong: the browser would honour text
// wrapping, real font families and embedded images — three things the PDF
// writer either drops or approximates — so the prettier the preview got,
// the more it would disagree with the file the user actually downloads.
// Rendering the exact bytes POST /report-definitions/preview returns makes
// "the file matches the preview" true by construction rather than by
// maintenance: there is only one renderer, and it is the real one.
//
// The format switcher is part of that same idea. Comparing formats is the
// whole point — a report that looks right in PDF and wrong in Excel is a
// thing an author needs to SEE, not discover after sending it to a client.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Eye, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { extractApiError } from '@/lib/api'
import { reportsApi } from './api'
import { ALL_FORMATS, FORMAT_PREVIEW_KIND } from './types'
import type { ExportFormat, ReportDefinition } from './types'

interface ReportPreviewDialogProps {
  open: boolean
  onClose: () => void
  definition: ReportDefinition
  /** Already-collected values for the report's declared arguments, when it
   *  has any — the prompt happens before this dialog opens, so a format
   *  switch here re-renders with the same values instead of re-asking. */
  argumentValues?: Record<string, unknown>
}

interface Rendered {
  blob: Blob
  filename: string
  rowCount: number
  /** Object URL, only for a format the browser renders in a frame. */
  url: string | null
  /** Decoded body, only for a text format. */
  text: string | null
}

export function ReportPreviewDialog({ open, onClose, definition, argumentValues }: ReportPreviewDialogProps) {
  const t = useTranslation()
  // PDF first when the report has no configured default: it is the only
  // format that shows real layout on screen, which is what a preview is for.
  const [format, setFormat] = useState<ExportFormat>(definition.settings.default_format ?? 'pdf')
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Every object URL this dialog has created, revoked on unmount/close. Held
  // in a ref rather than cleaned up inside the fetch effect because the URL
  // outlives that effect: the <iframe> is still displaying it.
  const urlsRef = useRef<string[]>([])
  const releaseUrls = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setPending(true)
    setError(null)
    void (async () => {
      try {
        const { blob, filename, rowCount } = await reportsApi.preview(definition, format, argumentValues)
        const kind = FORMAT_PREVIEW_KIND[format]
        const text = kind === 'text' ? await blob.text() : null
        if (cancelled) return

        let url: string | null = null
        if (kind === 'pdf') {
          url = URL.createObjectURL(blob)
          urlsRef.current.push(url)
        }
        setRendered({ blob, filename, rowCount, url, text })
      } catch (e) {
        if (!cancelled) {
          setRendered(null)
          setError(extractApiError(e))
        }
      } finally {
        if (!cancelled) setPending(false)
      }
    })()

    return () => { cancelled = true }
    // definition is intentionally not a dependency: the dialog previews the
    // canvas state as of the moment it opened. Re-fetching on every keystroke
    // behind it would be a request per edit, and would swap the document the
    // user is currently reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, format])

  useEffect(() => releaseUrls, [releaseUrls])

  const handleOpenChange = (next: boolean) => {
    if (next) return
    releaseUrls()
    setRendered(null)
    setError(null)
    onClose()
  }

  // Downloads the bytes already in hand rather than asking the server again,
  // so the file saved is provably the same one displayed above it.
  const handleDownload = () => {
    if (!rendered) return
    const url = URL.createObjectURL(rendered.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = rendered.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const previewKind = FORMAT_PREVIEW_KIND[format]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[88vh] w-[1100px] max-w-[95vw] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-[hsl(var(--border))] px-6 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/15">
                <Eye size={14} className="text-[hsl(var(--primary))]" />
              </div>
              <span className="truncate">
                {t('reports.preview.title')} — {definition.name || t('reports.preview.untitled')}
              </span>
            </DialogTitle>

            <div className="flex shrink-0 items-center gap-2">
              {rendered && !pending && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {rendered.rowCount === 1
                    ? t('reports.preview.row_count_one')
                    : t('reports.preview.row_count_other', { count: rendered.rowCount })}
                </span>
              )}
              <SelectMenu value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger className="h-8 w-[168px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_FORMATS.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">{t(`reports.format.${f}.label`)}</SelectItem>
                  ))}
                </SelectContent>
              </SelectMenu>
              <Button
                variant="outline" size="sm" className="h-8 gap-1.5"
                onClick={handleDownload}
                disabled={!rendered || pending}
              >
                <Download size={14} />
                {t('reports.preview.download')}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-[hsl(var(--muted))]/30">
          {pending ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
              <Spinner className="h-5 w-5" />
              {t('reports.preview.generating')}
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <FileWarning size={22} className="text-[hsl(var(--destructive))]" />
              <p className="text-sm font-medium">{t('reports.preview.failed')}</p>
              <p className="max-w-xl text-xs text-[hsl(var(--muted-foreground))]">{error}</p>
            </div>
          ) : !rendered ? null : previewKind === 'pdf' && rendered.url ? (
            <iframe
              src={rendered.url}
              title={t('reports.preview.title')}
              className="h-full w-full border-0"
            />
          ) : previewKind === 'text' ? (
            <ScrollArea className="h-full">
              <pre className="whitespace-pre-wrap p-6 font-mono text-xs leading-relaxed">{rendered.text}</pre>
            </ScrollArea>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <FileWarning size={22} className="text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm font-medium">
                {t('reports.preview.not_viewable', { format: t(`reports.format.${format}.label`) })}
              </p>
              <p className="max-w-md text-xs text-[hsl(var(--muted-foreground))]">
                {t('reports.preview.not_viewable_hint')}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleDownload}>
                  <Download size={14} />
                  {t('reports.preview.download_to_view')}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setFormat('pdf')}>
                  {t('reports.preview.view_pdf_instead')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
