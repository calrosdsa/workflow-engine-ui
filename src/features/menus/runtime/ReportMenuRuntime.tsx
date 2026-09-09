// Runtime renderer for the Report menu type — the on-screen counterpart to
// the Report Builder's own Preview (byte-faithful export) and
// export_report's downloaded file. Resolves a SAVED report via
// POST /report-definitions/{id}/runtime (api/reports/handler.go's Runtime)
// into JSON and renders it directly as HTML: sortable-free but real,
// clickable, drills into records — the fidelity claim per the design plan
// is "same numbers, same columns, same totals, same number_format", not
// "same pixels" the way Preview's export bytes are.
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Pagination } from '@/components/ui/pagination'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { extractApiError } from '@/lib/api'
import { useReport, useRuntimeReport, useExportReport } from '@/features/reports/hooks'
import { ReportArgumentInput } from '@/features/reports/ReportArgumentsDialog'
import {
  declaredArguments, initialArgumentValues, missingRequiredArguments, pruneEmptyArguments, needsPrompt,
} from '@/features/reports/arguments'
import { FORMAT_LABELS } from '@/features/reports/types'
import type { RuntimeReportBlock, RuntimeReportRow } from '@/features/reports/api'
import type { ExportFormat, ReportSettings } from '@/features/reports/types'
import type { Menu, ReportMenuConfig } from '../types'

interface ReportMenuRuntimeProps {
  menu: Menu
  onNavigate?: (slug: string) => void
}

export function ReportMenuRuntime({ menu, onNavigate }: ReportMenuRuntimeProps) {
  const config = menu.config as ReportMenuConfig
  const reportId = config.report_definition_id

  const { data: reportRow, isLoading: definitionLoading } = useReport(reportId)
  const runtime = useRuntimeReport(reportId)

  const argumentList = useMemo(
    () => (reportRow ? declaredArguments(reportRow.definition) : []),
    [reportRow],
  )
  const [values, setValues] = useState<Record<string, unknown>>({})

  // Re-seed argument state whenever the underlying report identity changes
  // (a different menu, or this menu's report was swapped in the builder) —
  // the same "never leak a previous run's edits" reasoning
  // ReportArgumentsDialog applies on reopen, applied here to a report
  // change instead of a dialog reopen.
  useEffect(() => {
    setValues(initialArgumentValues(argumentList))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, argumentList.length])

  // Auto-run once the report loads if nothing actually needs asking (every
  // argument is optional or already has a default) — a viewer shouldn't
  // have to click Run just to see a report that takes no real input,
  // mirroring Preview/export_report's own "stay one-click whenever
  // possible" stance (declaredArguments' needsPrompt).
  useEffect(() => {
    if (!reportRow) return
    if (needsPrompt(argumentList)) return
    if (runtime.data || runtime.isPending) return
    runtime.mutate(pruneEmptyArguments(argumentList, initialArgumentValues(argumentList)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportRow, reportId])

  const setValue = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }))
  const missing = missingRequiredArguments(argumentList, values)
  const run = () => runtime.mutate(pruneEmptyArguments(argumentList, values))

  if (!reportId) {
    return (
      <EmptyNote>No report selected yet. Choose one in this menu's own settings.</EmptyNote>
    )
  }

  if (definitionLoading) {
    return <CenteredSpinner />
  }

  if (!reportRow) {
    return <EmptyNote>This report no longer exists.</EmptyNote>
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{reportRow.name}</h2>
        <ReportDownloadButton
          reportId={reportId}
          settings={reportRow.definition.settings}
          argumentValues={pruneEmptyArguments(argumentList, values)}
          disabled={missing.length > 0}
        />
      </div>

      {argumentList.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-[hsl(var(--border))] p-3">
          {argumentList.map((argument) => (
            <div key={argument.key} className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                {argument.label}
                {argument.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
              </Label>
              <ReportArgumentInput
                argument={argument}
                value={values[argument.key]}
                onChange={(value) => setValue(argument.key, value)}
                disabled={runtime.isPending}
              />
            </div>
          ))}
          <Button size="sm" onClick={run} disabled={runtime.isPending || missing.length > 0}>
            {runtime.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {runtime.data ? 'Refresh' : 'Run'}
          </Button>
        </div>
      )}

      {runtime.isError && (
        <div
          className="flex items-center gap-2 rounded-md border p-3 text-sm"
          style={{ borderColor: 'hsl(var(--destructive) / 0.3)', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {runtime.error instanceof Error ? runtime.error.message : 'Failed to load this report.'}
        </div>
      )}

      {runtime.isPending && !runtime.data && <CenteredSpinner />}

      {!runtime.data && !runtime.isPending && !runtime.isError && argumentList.length > 0 && (
        <EmptyNote>Set the filters above and click Run to see this report.</EmptyNote>
      )}

      {runtime.data && runtime.data.blocks.length === 0 && (
        <EmptyNote>&quot;{reportRow.name}&quot; has no content yet.</EmptyNote>
      )}

      {runtime.data?.blocks.map((block) => (
        <ReportBlockView key={block.id} block={block} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

// The runtime viewer's own Download button — POST /report-definitions/{id}/
// export (api/reports/handler.go's Export), submitting exactly the argument
// values currently on screen (the caller-supplied argumentValues prop),
// never a re-prompt. Placed next to the report title rather than strictly
// beside the filter bar's own Refresh/Run button, because a report with no
// declared arguments renders no filter bar at all (it auto-runs on mount) —
// gating the only download affordance behind having a filter bar would
// leave every argument-less report undownloadable.
//
// Per the plan: a format picker only when the report's own settings narrow
// allowed_formats to more than one choice; otherwise this downloads
// whatever settings.default_format says (a report with neither configured
// errors clearly from the server when clicked, which is a report-authoring
// problem this viewer doesn't try to pre-validate).
function ReportDownloadButton({
  reportId, settings, argumentValues, disabled,
}: {
  reportId: string
  settings: ReportSettings
  argumentValues: Record<string, unknown>
  disabled?: boolean
}) {
  const exportReport = useExportReport(reportId)
  const choices = settings.allowed_formats && settings.allowed_formats.length > 1 ? settings.allowed_formats : undefined
  const [format, setFormat] = useState<ExportFormat>(settings.default_format ?? choices?.[0] ?? 'pdf')

  const handleDownload = () => {
    const toastId = toast.loading('Preparing download…')
    exportReport.mutate(
      { format: choices ? format : settings.default_format, argumentValues },
      {
        onSuccess: ({ blob, filename, rowCount }) => {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          link.click()
          URL.revokeObjectURL(url)
          toast.success('Download ready', {
            id: toastId,
            description: `${filename} · ${rowCount} row${rowCount === 1 ? '' : 's'}`,
          })
        },
        onError: (e) => {
          toast.error("Couldn't download this report", { id: toastId, description: extractApiError(e) })
        },
      },
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {choices && (
        <SelectMenu value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
          <SelectTrigger className="h-8 w-[128px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {choices.map((f) => (
              <SelectItem key={f} value={f} className="text-xs">{FORMAT_LABELS[f]}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      )}
      <Button
        size="sm" variant="outline" className="h-8 gap-1.5"
        onClick={handleDownload}
        disabled={disabled || exportReport.isPending}
      >
        {exportReport.isPending
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Download className="h-4 w-4" />}
        Download
      </Button>
    </div>
  )
}

function CenteredSpinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
      {children}
    </div>
  )
}

function ReportBlockView({ block, onNavigate }: { block: RuntimeReportBlock; onNavigate?: (slug: string) => void }) {
  switch (block.type) {
    case 'text':
      return block.text ? <p className="whitespace-pre-wrap text-sm">{block.text}</p> : null

    case 'image':
      return block.image ? (
        <img
          src={block.image.link_url}
          alt={block.image.alt ?? ''}
          className="max-w-full rounded-md border"
          style={{ borderColor: 'hsl(var(--border))' }}
        />
      ) : null

    // table/group/related all resolve to the same headers+rows tabular
    // shape (ResolvedTable) server-side — only "table" rows ever carry a
    // source_id (see block.form_id's own doc comment), so group/related
    // simply render as a non-clickable table with no further branching
    // needed here.
    case 'table':
    case 'group':
    case 'related':
      return <ReportTableBlockView block={block} onNavigate={onNavigate} />

    default:
      return null
  }
}

// Pagination (components/ui/pagination.tsx) renders one button per page
// with no ellipsis collapsing, and a single block can carry up to
// DefaultRuntimeRowCap (5,000) rows, so a small default page size would make
// the pager itself the least usable thing on the screen. Scaled up from
// KnowledgeBaseDetailPage's own client-paged list ([10,20,50,100]), the
// nearest precedent for this exact sort+page-in-memory shape.
const PAGE_SIZE_OPTIONS = [50, 100, 250, 500]
const DEFAULT_PAGE_SIZE = 100

function ReportTableBlockView({ block, onNavigate }: { block: RuntimeReportBlock; onNavigate?: (slug: string) => void }) {
  const t = useTranslation()
  const headers = block.headers ?? []

  // undefined means "server order". A table/group block's rows already
  // reflect whatever sort_by/sort_dir or data-source sort the report's
  // author configured server-side, so this must not silently re-sort by
  // some column the moment it mounts — only a header click
  // (handleSortChange) turns this into an active client-side sort.
  const [sortField, setSortField] = useState<string | undefined>(undefined)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // The total row (ResolvedTable.HasTotalRow's own doc comment: "the LAST
  // entry in Rows") gets pulled into DataTable's dedicated footer slot for
  // a visually distinct summary line, rather than rendered as just another
  // <tr> indistinguishable from a data row. Memoized together so sortedRows
  // below sees one stable reference instead of a fresh .slice() every
  // render.
  const { dataRows, totalRow } = useMemo(() => {
    const rows = block.rows ?? []
    return block.has_total_row
      ? { dataRows: rows.slice(0, -1), totalRow: rows[rows.length - 1] as RuntimeReportRow | undefined }
      : { dataRows: rows, totalRow: undefined as RuntimeReportRow | undefined }
  }, [block.rows, block.has_total_row])

  // A fresh run (Refresh, or different filter arguments) replaces block.rows
  // wholesale even though the block keeps the same id across runs — that id
  // is what keeps this component mounted (see the parent's key={block.id})
  // instead of resetting its own state for free — so reset to page 1 here,
  // or a narrower result could leave the viewer stuck on a page past the
  // new row count.
  useEffect(() => {
    setPage(1)
  }, [block.rows])

  const sortColumnIndex = sortField ? Number(sortField.slice(1)) : undefined

  // Sorted over the resolved Cell{text,num} pair, BEFORE flattening to a
  // DataTable record — not over the display string. A currency column's
  // text is server-formatted ("$1,200.00"), and lexical order would put
  // "$999.00" ahead of it; num already exists for exactly this (the column
  // alignment two lines below already reads it), rowToRecord just never
  // carried it forward until now.
  const sortedRows = useMemo(() => {
    if (sortColumnIndex === undefined) return dataRows
    const copy = [...dataRows]
    copy.sort((a, b) => {
      const av = a.cells[sortColumnIndex]
      const bv = b.cells[sortColumnIndex]
      const cmp = av?.num !== undefined && bv?.num !== undefined
        ? av.num - bv.num
        : (av?.text ?? '').localeCompare(bv?.text ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [dataRows, sortColumnIndex, sortDir])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize)
  const showPager = sortedRows.length > pageSize

  const columns: DataTableColumn[] = headers.map((label, i) => ({
    key: `c${i}`,
    label,
    sortable: true,
    align: dataRows.some((r) => r.cells[i]?.num !== undefined) ? 'right' : 'left',
  }))

  // Indexed against the full sorted list, not the page slice — cosmetic,
  // not load-bearing, since __rowIndex is only ever read as a React key.
  const rows = pagedRows.map((row, i) => rowToRecord(row, (page - 1) * pageSize + i))
  const footer = totalRow
    ? Object.fromEntries(totalRow.cells.map((cell, i) => [`c${i}`, cell.text]))
    : undefined

  const handleSortChange = (field: string) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleClick = (row: Record<string, unknown>) => {
    const sourceId = row.__sourceId as string | undefined
    if (!sourceId || !block.form_id) return
    onNavigate?.(`forms/${block.form_id}/${sourceId}`)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {block.title && <h3 className="text-sm font-medium">{block.title}</h3>}
      <div className="overflow-x-auto rounded-md border" style={{ borderColor: 'hsl(var(--border))' }}>
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.__rowIndex)}
          sortField={sortField}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          onRowClick={block.form_id ? handleClick : undefined}
          isRowClickable={(row) => !!row.__sourceId}
          footer={footer}
          emptyMessage="No rows."
        />
      </div>
      {showPager && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {sortedRows.length === 1
              ? t('reports.preview.row_count_one')
              : t('reports.preview.row_count_other', { count: sortedRows.length })}
          </p>
          <div className="flex items-center gap-2">
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
            <SelectMenu value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
              <SelectTrigger className="h-7 w-[92px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {t('reports.runtime.page_size_option', { count: n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
          </div>
        </div>
      )}
    </div>
  )
}

function rowToRecord(row: RuntimeReportRow, index: number): Record<string, unknown> {
  const record: Record<string, unknown> = { __rowIndex: index, __sourceId: row.source_id }
  row.cells.forEach((cell, i) => { record[`c${i}`] = cell.text })
  return record
}
