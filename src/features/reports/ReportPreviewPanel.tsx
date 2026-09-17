// The report builder's docked preview (RF-303) — replaces the earlier
// modal (ReportPreviewDialog). See ReportPreviewPanel.test.tsx and this
// file's own comments below for the behavior this conversion has to keep.
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
//
// WHY A DOCKED PANEL THAT STAYS MOUNTED, NOT A DIALOG THAT OPENS/CLOSES
// -----------------------------------------------------------------------
// The old modal fetched once on open and threw everything away on close.
// That made "keep editing while the last PDF is still visible" and "closing
// the panel doesn't lose anything" true by NOT EXISTING while collapsed —
// which also meant every re-open was a fresh network round trip. This
// panel is always mounted; "collapsed" only hides its body behind
// `hidden`, so the rendered iframe/text never unmounts and the object URL
// backing it is only replaced (and revoked) by a NEW successful render,
// never by the user tucking the panel away.
//
// WHY GENERATION ONLY HAPPENS ON EXPLICIT REFRESH/FORMAT-SWITCH, NEVER ON
// DEFINITION CHANGE
// -----------------------------------------------------------------------
// An always-mounted panel that re-fetched whenever `definition` changed
// would fire a request per keystroke, and would fire one on page load for
// every author who never even opens it. Instead, an edit after a
// successful render only flips `stale` (definition !== the one that was
// actually rendered) — a pure comparison, no network call. Generation is
// driven exclusively by the imperative `open()` handle (the toolbar
// Preview button), the header's Refresh button, and a format switch.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download, Eye, FileWarning, GripHorizontal, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { extractApiError } from '@/lib/api'
import { reportsApi } from './api'
import { ALL_FORMATS, FORMAT_PREVIEW_KIND } from './types'
import type { ExportFormat, ReportDefinition } from './types'

const MIN_HEIGHT = 200
const MAX_HEIGHT = 700
const DEFAULT_HEIGHT = 340
const COLLAPSED_HEIGHT = 44

export interface ReportPreviewPanelHandle {
  /** Expands the panel and starts a fresh generation — the toolbar Preview
   *  button's entry point, same "every click renders fresh" contract the
   *  old modal had. argumentValues, once collected here, are reused by
   *  this panel's own Refresh/format-switch until the next open() call. */
  open: (argumentValues?: Record<string, unknown>) => void
}

interface ReportPreviewPanelProps {
  definition: ReportDefinition
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

export const ReportPreviewPanel = forwardRef<ReportPreviewPanelHandle, ReportPreviewPanelProps>(
  function ReportPreviewPanel({ definition }, ref) {
    const t = useTranslation()
    const [collapsed, setCollapsed] = useState(true)
    const [height, setHeight] = useState(DEFAULT_HEIGHT)
    // PDF first when the report has no configured default: it is the only
    // format that shows real layout on screen, which is what a preview is for.
    const [format, setFormat] = useState<ExportFormat>(definition.settings.default_format ?? 'pdf')
    const [argumentValues, setArgumentValues] = useState<Record<string, unknown> | undefined>()
    const [rendered, setRendered] = useState<Rendered | null>(null)
    // The exact definition object a successful render came from — reference
    // equality against the live `definition` prop is what `stale` below is.
    // Every store mutation produces a new definition object (see store.ts's
    // undo/redo), so this never needs a deep comparison.
    const [renderedForDefinition, setRenderedForDefinition] = useState<ReportDefinition | null>(null)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const abortRef = useRef<AbortController | null>(null)
    // The single object URL currently backing the <iframe>, replaced (and
    // the old one revoked) by each new successful PDF render — not
    // accumulated, since this panel can live through many refreshes.
    const currentUrlRef = useRef<string | null>(null)

    useEffect(() => () => {
      abortRef.current?.abort()
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current)
    }, [])

    const runGeneration = useCallback((fmt: ExportFormat, argVals: Record<string, unknown> | undefined, forDefinition: ReportDefinition) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setPending(true)
      setError(null)
      void (async () => {
        try {
          const { blob, filename, rowCount } = await reportsApi.preview(forDefinition, fmt, argVals, controller.signal)
          if (controller.signal.aborted) return
          const kind = FORMAT_PREVIEW_KIND[fmt]
          const text = kind === 'text' ? await blob.text() : null
          if (controller.signal.aborted) return

          let url: string | null = null
          if (kind === 'pdf') {
            url = URL.createObjectURL(blob)
            if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current)
            currentUrlRef.current = url
          }
          setRendered({ blob, filename, rowCount, url, text })
          setRenderedForDefinition(forDefinition)
          setPending(false)
        } catch (e) {
          // Aborted because a newer generation superseded this one — the
          // newer call owns pending/error/rendered now, so this one must
          // not touch any of them (mirrors NodeConfigPanel.tsx's own
          // controller.signal.aborted check for the same reason).
          if (controller.signal.aborted) return
          // Deliberately does NOT clear `rendered`: a failed REFRESH keeps
          // showing the last successful preview (RF-303 acceptance
          // criterion), with `error` driving an inline "couldn't refresh"
          // banner instead of blanking the body. Only a first-ever
          // generation (rendered still null) falls through to the full
          // error state below.
          setError(extractApiError(e))
          setPending(false)
        }
      })()
    }, [])

    useImperativeHandle(ref, () => ({
      open: (argVals) => {
        setCollapsed(false)
        setArgumentValues(argVals)
        runGeneration(format, argVals, definition)
      },
    }), [format, definition, runGeneration])

    const handleRefresh = () => runGeneration(format, argumentValues, definition)

    const handleFormatChange = (f: ExportFormat) => {
      setFormat(f)
      runGeneration(f, argumentValues, definition)
    }

    const handleDownload = () => {
      if (!rendered) return
      const url = URL.createObjectURL(rendered.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = rendered.filename
      link.click()
      URL.revokeObjectURL(url)
    }

    const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.preventDefault()
      const startY = e.clientY
      const startHeight = height
      const onMove = (ev: MouseEvent) => {
        const delta = startY - ev.clientY
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta)))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }

    // The ARIA "window splitter" pattern (role="separator" + tabIndex +
    // aria-value*) needs a keyboard equivalent of the drag above, or the
    // handle is mouse-only — resize is secondary to collapse (which has its
    // own, already-keyboard-operable button), but it should not regress a
    // keyboard-only author below what dragging offers a mouse user.
    const RESIZE_STEP = 24
    const handleResizeKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); setHeight((h) => Math.min(MAX_HEIGHT, h + RESIZE_STEP)) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setHeight((h) => Math.max(MIN_HEIGHT, h - RESIZE_STEP)) }
      else if (e.key === 'Home') { e.preventDefault(); setHeight(MIN_HEIGHT) }
      else if (e.key === 'End') { e.preventDefault(); setHeight(MAX_HEIGHT) }
    }

    const stale = rendered !== null && renderedForDefinition !== null && renderedForDefinition !== definition
    const hasEverGenerated = rendered !== null || error !== null || pending
    const outOfDate = rendered !== null && (stale || error !== null)
    const previewKind = FORMAT_PREVIEW_KIND[format]

    return (
      <div
        className="flex shrink-0 flex-col overflow-hidden border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]"
        style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
      >
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('reports.preview.resize_handle')}
            aria-valuenow={height}
            aria-valuemin={MIN_HEIGHT}
            aria-valuemax={MAX_HEIGHT}
            tabIndex={0}
            className="flex h-2 shrink-0 cursor-row-resize items-center justify-center hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            onMouseDown={handleResizeMouseDown}
            onKeyDown={handleResizeKeyDown}
          >
            <GripHorizontal size={12} className="text-[hsl(var(--muted-foreground))]" />
          </div>
        )}

        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex min-w-0 items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('reports.preview.expand') : t('reports.preview.collapse')}
            title={collapsed ? t('reports.preview.expand') : t('reports.preview.collapse')}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <Eye size={14} className="text-[hsl(var(--primary))]" />
            <span className="truncate">{t('reports.preview.title')}</span>
            {outOfDate && (
              <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--warning))]/10 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--warning))]">
                {t('reports.preview.stale_badge')}
              </span>
            )}
          </button>

          {hasEverGenerated && (
            <div className="flex shrink-0 items-center gap-2">
              {rendered && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {rendered.rowCount === 1
                    ? t('reports.preview.row_count_one')
                    : t('reports.preview.row_count_other', { count: rendered.rowCount })}
                </span>
              )}
              <SelectMenu value={format} onValueChange={(v) => handleFormatChange(v as ExportFormat)}>
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
                onClick={handleRefresh}
                title={t('reports.preview.refresh')}
              >
                <RefreshCw size={14} className={pending ? 'animate-spin' : undefined} />
                {t('reports.preview.refresh')}
              </Button>
              <Button
                variant="outline" size="sm" className="h-8 gap-1.5"
                onClick={handleDownload}
                disabled={!rendered}
              >
                <Download size={14} />
                {t('reports.preview.download')}
              </Button>
            </div>
          )}
        </div>

        <div className={collapsed ? 'hidden' : 'min-h-0 flex-1 bg-[hsl(var(--muted))]/30'}>
          {!hasEverGenerated ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
              <Eye size={22} className="text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm font-medium">{t('reports.preview.no_preview_yet')}</p>
              <p className="max-w-xs text-xs text-[hsl(var(--muted-foreground))]">{t('reports.preview.no_preview_yet_hint')}</p>
            </div>
          ) : (
            <>
              {outOfDate && (
                <div className="flex items-center gap-2 border-b border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-4 py-1.5 text-xs text-[hsl(var(--warning))]">
                  <FileWarning size={13} />
                  {error ? t('reports.preview.refresh_failed') : t('reports.preview.stale_hint')}
                </div>
              )}

              {rendered ? (
                previewKind === 'pdf' && rendered.url ? (
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
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => handleFormatChange('pdf')}>
                        {t('reports.preview.view_pdf_instead')}
                      </Button>
                    </div>
                  </div>
                )
              ) : pending ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  <Spinner className="h-5 w-5" />
                  {t('reports.preview.generating')}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
                  <FileWarning size={22} className="text-[hsl(var(--destructive))]" />
                  <p className="text-sm font-medium">{t('reports.preview.failed')}</p>
                  <p className="max-w-xl text-xs text-[hsl(var(--muted-foreground))]">{error}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  },
)
