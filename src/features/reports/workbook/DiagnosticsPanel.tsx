// RF-304's diagnostics tab — surfaces Engine.Inspect's severity-classified
// findings (overlap, dropped merge, spill, formula error) inside the
// builder, and lets an author jump straight to the offending sheet/cell.
//
// WHY ON-DEMAND, NOT AUTOMATIC ON MOUNT OR ON EVERY EDIT
// -----------------------------------------------------------------------
// ReportPreviewPanel (RF-303) already settled this question for Preview:
// an always-fetching panel fires a request per keystroke and one on load
// for every author who never even looks at it. Diagnostics is the same
// shape of problem — Inspect renders the whole workbook through the same
// grid math Preview does, it is not a free client-side check — so it gets
// the same answer: nothing runs until "Run diagnostics" is clicked, and an
// edit after a successful run only flips `stale`, a pure reference
// comparison, never a network call.
//
// WHY getDefinition(), NOT THE definition PROP, FOR THE ACTUAL RUN
// -----------------------------------------------------------------------
// See ReportPreviewPanel's own getDefinition doc comment — the identical
// hazard applies here: a click handler can flush a live canvas edit into
// the store and trigger a run in the same synchronous call stack, and
// React defers this component's own `definition` prop update until after
// that handler returns. Every run trigger below (the initial run, Refresh,
// and a format switch) calls getDefinition() fresh rather than trusting the
// closed-over prop, which is kept only for the initial format seed, the
// argument-declaration gate, and the stale-comparison below.
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, FileWarning, Info, RefreshCw, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { extractApiError } from '@/lib/api'
import { declaredArguments, needsPrompt } from '../arguments'
import { reportsApi } from '../api'
import type { Diagnostic, DiagnosticSeverity, InspectResult } from '../api'
import { ReportArgumentsDialog } from '../ReportArgumentsDialog'
import { hasRenderableContent } from '../run-report'
import { ALL_FORMATS } from '../types'
import type { ExportFormat, ReportBlockRegion, ReportDefinition } from '../types'

export interface DiagnosticsPanelProps {
  definition: ReportDefinition
  getDefinition: () => ReportDefinition
  onFocusRegion: (region: ReportBlockRegion) => void
}

const SEVERITY_ORDER: DiagnosticSeverity[] = ['error', 'warning', 'info']

interface LocatedDiagnostic extends Diagnostic {
  sheetName: string
}

function flattenDiagnostics(result: InspectResult): LocatedDiagnostic[] {
  return result.sheets.flatMap((sheet) =>
    (sheet.diagnostics ?? []).map((d) => ({ ...d, sheetName: sheet.name })),
  )
}

function severityIcon(severity: DiagnosticSeverity) {
  switch (severity) {
    case 'error': return <AlertCircle size={14} className="shrink-0 text-[hsl(var(--destructive))]" />
    case 'warning': return <AlertTriangle size={14} className="shrink-0 text-[hsl(var(--warning))]" />
    case 'info': return <Info size={14} className="shrink-0 text-[hsl(var(--info))]" />
  }
}

export function DiagnosticsPanel({ definition, getDefinition, onFocusRegion }: DiagnosticsPanelProps) {
  const t = useTranslation()
  const [format, setFormat] = useState<ExportFormat>(definition.settings.default_format ?? 'pdf')
  const [argumentValues, setArgumentValues] = useState<Record<string, unknown> | undefined>()
  const [promptOpen, setPromptOpen] = useState(false)
  const [result, setResult] = useState<InspectResult | null>(null)
  // Mirrors ReportPreviewPanel's renderedForDefinition: the exact definition
  // object the last successful run inspected, compared by reference against
  // the live `definition` prop to drive `stale` below — see that panel's own
  // comment for why reference equality (not a deep compare) is sufficient.
  const [resultForDefinition, setResultForDefinition] = useState<ReportDefinition | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cancels a superseded run (rapid Refresh clicks, a format switch fired
  // before the previous one resolved) — the same reason ReportPreviewPanel
  // aborts its own in-flight request rather than letting an older response
  // clobber a newer one.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const runInspection = useCallback((fmt: ExportFormat, argVals: Record<string, unknown> | undefined, forDefinition: ReportDefinition) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    setError(null)
    void (async () => {
      try {
        const inspected = await reportsApi.inspect(forDefinition, fmt, argVals, controller.signal)
        if (controller.signal.aborted) return
        setResult(inspected)
        setResultForDefinition(forDefinition)
        setPending(false)
      } catch (e) {
        if (controller.signal.aborted) return
        setError(extractApiError(e))
        setPending(false)
      }
    })()
  }, [])

  const startRun = (argVals: Record<string, unknown> | undefined) => {
    setPromptOpen(false)
    setArgumentValues(argVals)
    runInspection(format, argVals, getDefinition())
  }

  // Both the first run and every later Re-run go through this one gate —
  // unlike PreviewButton/ReportPreviewPanel's split (a separate button owns
  // the gate, the panel only ever generates), this panel's single button is
  // both, so it must re-check on every click, not just the first: a report
  // can gain a new required argument between an initial run and a Re-run,
  // and passing the previously-resolved argumentValues as `resolved` lets
  // needsPrompt tell "still nothing new to fill" from "there's a fresh gap".
  const handleTriggerRun = () => {
    const current = getDefinition()
    if (!hasRenderableContent(current)) return
    if (needsPrompt(declaredArguments(current), argumentValues)) {
      setPromptOpen(true)
      return
    }
    startRun(argumentValues)
  }

  const handleFormatChange = (f: ExportFormat) => {
    setFormat(f)
    runInspection(f, argumentValues, getDefinition())
  }

  const handleDiagnosticClick = (d: Diagnostic) => {
    if (!d.location) return
    // sheet_id is typed optional only because Diagnostic.location mirrors
    // Go's omitempty JSON tags — every constructor in diagnostics.go
    // actually takes sheetID as its first, non-optional parameter, and
    // inspect.go passes sheet.ID at all four call sites, so this is never
    // really absent.
    onFocusRegion({ sheet_id: d.sheet_id!, layout: d.location })
  }

  const stale = result !== null && resultForDefinition !== null && resultForDefinition !== definition
  const hasEverRun = result !== null || error !== null || pending
  const outOfDate = result !== null && (stale || error !== null)
  const diagnostics = result ? flattenDiagnostics(result) : []
  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: diagnostics.filter((d) => d.severity === severity),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ScanSearch size={15} className="text-[hsl(var(--primary))]" />
          <h2 className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{t('reports.diagnostics.title')}</h2>
          {outOfDate && (
            <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--warning))]/10 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--warning))]">
              {t('reports.diagnostics.stale_badge')}
            </span>
          )}
        </div>
        {hasEverRun && (
          <SelectMenu value={format} onValueChange={(v) => handleFormatChange(v as ExportFormat)}>
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_FORMATS.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">{t(`reports.format.${f}.label`)}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>
        )}
      </div>

      <div className="border-b border-[hsl(var(--border))] p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full gap-1.5"
          onClick={handleTriggerRun}
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : hasEverRun ? <RefreshCw size={14} /> : <ScanSearch size={14} />}
          {hasEverRun ? t('reports.diagnostics.rerun') : t('reports.diagnostics.run')}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {!hasEverRun ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <ScanSearch size={20} className="text-[hsl(var(--muted-foreground))]" />
            <p className="text-xs font-medium">{t('reports.diagnostics.no_run_yet')}</p>
            <p className="max-w-[220px] text-[11px] text-[hsl(var(--muted-foreground))]">{t('reports.diagnostics.no_run_yet_hint')}</p>
          </div>
        ) : pending && !result ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-xs text-[hsl(var(--muted-foreground))]">
            <Spinner className="h-4 w-4" />
            {t('reports.diagnostics.running')}
          </div>
        ) : error && !result ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <FileWarning size={20} className="text-[hsl(var(--destructive))]" />
            <p className="text-xs font-medium">{t('reports.diagnostics.failed')}</p>
            <p className="max-w-[240px] text-[11px] text-[hsl(var(--muted-foreground))]">{error}</p>
          </div>
        ) : result ? (
          <div className="flex flex-col">
            {error && (
              <div className="flex items-center gap-2 border-b border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-3 py-1.5 text-[11px] text-[hsl(var(--warning))]">
                <FileWarning size={12} />
                {t('reports.diagnostics.refresh_failed')}
              </div>
            )}
            {!result.grid_diagnostics && result.grid_diagnostics_note && (
              <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                <Info size={12} className="shrink-0" />
                {result.grid_diagnostics_note}
              </div>
            )}
            {diagnostics.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                <p className="text-xs font-medium">{t('reports.diagnostics.clean')}</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.severity}>
                  <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {t(`reports.diagnostics.severity.${group.severity}`)} · {group.items.length}
                  </div>
                  {group.items.map((d, i) => (
                    <button
                      key={`${group.severity}-${i}`}
                      type="button"
                      onClick={() => handleDiagnosticClick(d)}
                      disabled={!d.location}
                      className="flex w-full items-start gap-2 border-b border-[hsl(var(--border))]/50 px-3 py-2 text-left text-xs hover:bg-[hsl(var(--muted))]/40 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      {severityIcon(d.severity)}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] leading-snug text-[hsl(var(--foreground))]">{d.message}</span>
                        {d.sheetName && (
                          <span className="mt-0.5 block text-[10px] text-[hsl(var(--muted-foreground))]">{d.sheetName}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : null}
      </ScrollArea>

      {/* confirmLabel deliberately omitted — its default ("Run") stays
          distinct from the "Run diagnostics"/"Re-run diagnostics" trigger
          buttons above, which stay mounted behind this dialog. */}
      <ReportArgumentsDialog
        open={promptOpen}
        argumentList={declaredArguments(definition)}
        title={t('reports.diagnostics.run_dialog_title')}
        busy={false}
        onCancel={() => setPromptOpen(false)}
        onConfirm={(values) => startRun(values)}
      />
    </div>
  )
}
