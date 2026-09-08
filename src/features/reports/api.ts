import { api } from '@/lib/api'
import type { ReportDefinitionRow, ReportDefinition, ExportFormat, NumberFormat } from './types'

export interface CreateReportPayload {
  name: string
  definition: ReportDefinition
}

export interface PreviewResult {
  blob: Blob
  filename: string
  rowCount: number
}

// Mirrors internal/reports/runtime.go's RuntimeReport* types exactly — the
// resolved-JSON contract POST /report-definitions/{id}/runtime returns, as
// opposed to Preview's rendered-bytes contract above. See that Go file's own
// doc comment for why this is a hand-written shape, not WorkbookIR: an HTML
// viewer has no use for spreadsheet anchor/merge/column-width geometry.
export interface RuntimeReportCell {
  text: string
  num?: number
}

export interface RuntimeReportRow {
  cells: RuntimeReportCell[]
  /** Set only for a "table" block's rows (never group/related/text/image) —
   *  a viewer uses its presence, not the block's own type, to decide
   *  whether a row is drill-down-able. */
  source_id?: string
}

export interface RuntimeReportImage {
  link_url: string
  content_type?: string
  alt?: string
}

export interface RuntimeReportBlock {
  id: string
  name?: string
  type: string
  title?: string
  text?: string
  image?: RuntimeReportImage
  headers?: string[]
  rows?: RuntimeReportRow[]
  has_total_row?: boolean
  column_formats?: (NumberFormat | null)[]
  /** The form every row's source_id belongs to — present exactly when at
   *  least one row could carry a source_id (i.e. this is a "table" block). */
  form_id?: string
}

export interface RuntimeReportResult {
  name: string
  blocks: RuntimeReportBlock[]
}

// Parses a Content-Disposition header of the form
// `attachment; filename="foo.csv"` (as set by api/reports/handler.go's
// Preview) back into the bare filename — a small hand-rolled parse rather
// than a dependency, since the server-controlled shape here is fixed and
// simple (always double-quoted, never the filename*=UTF-8''... extended
// form this codebase's own writer never emits).
function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = /filename="([^"]+)"/.exec(header)
  return match ? match[1] : fallback
}

export const reportsApi = {
  list: () => api.get('report-definitions').json<ReportDefinitionRow[]>(),
  get:  (id: string) => api.get(`report-definitions/${id}`).json<ReportDefinitionRow>(),

  create: (payload: CreateReportPayload) =>
    api.post('report-definitions', { json: payload }).json<ReportDefinitionRow>(),

  update: (id: string, payload: CreateReportPayload) =>
    api.put(`report-definitions/${id}`, { json: payload }).json<ReportDefinitionRow>(),

  delete: (id: string) => api.delete(`report-definitions/${id}`),

  // Generates a report from an INLINE (possibly unsaved) definition and
  // streams the rendered file straight back — no report_definitions row is
  // read, no content_objects row is written server-side (api/reports/
  // handler.go's Preview, FR-J1-001's own "Preview" button). format, when
  // given, overrides the definition's own default_format for this one call.
  preview: async (
    definition: ReportDefinition,
    format?: ExportFormat,
    argumentValues?: Record<string, unknown>,
  ): Promise<PreviewResult> => {
    const res = await api.post('report-definitions/preview', {
      json: { definition, format, arguments: argumentValues },
    })
    const blob = await res.blob()
    const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), 'report')
    const rowCount = Number(res.headers.get('X-Report-Row-Count') ?? '0')
    return { blob, filename, rowCount }
  },

  // Resolves a SAVED report into its on-screen JSON shape (api/reports/
  // handler.go's Runtime) — the "report" menu type's own runtime viewer.
  // Unlike preview() above, this reads a report_definitions row server-side
  // by id rather than carrying the definition inline, and its own
  // authorization (reports.CallerPassesVisibility) is what decides whether
  // this call succeeds — an ordinary application:read caller, not just a
  // report author, can call this.
  runtime: (id: string, argumentValues?: Record<string, unknown>) =>
    api.post(`report-definitions/${id}/runtime`, { json: { arguments: argumentValues } }).json<RuntimeReportResult>(),
}
