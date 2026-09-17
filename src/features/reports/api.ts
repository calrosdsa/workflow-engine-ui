import { api } from '@/lib/api'
import type { BlockLayout, ReportDefinitionRow, ReportDefinition, ExportFormat, NumberFormat } from './types'

// Mirrors internal/reports's Diagnostic/DiagnosticSeverity/DiagnosticKind
// (Go, diagnostics.go) exactly (RF-304).
export type DiagnosticSeverity = 'error' | 'warning' | 'info'
export type DiagnosticKind = 'overlap' | 'dropped_merge' | 'spill' | 'formula_error'

export interface Diagnostic {
  kind: DiagnosticKind
  severity: DiagnosticSeverity
  message: string
  sheet_id?: string
  // Reuses BlockLayout's {row, col, row_span, col_span} shape — the exact
  // same shape ReportBlockRegion.layout already is, so a Diagnostic's own
  // location can be handed straight to WorkbookSurfaceHandle.focusRegion
  // as `{ sheet_id: diagnostic.sheet_id, layout: diagnostic.location }`
  // with no reshaping.
  location?: BlockLayout
}

// Mirrors internal/reports.ElementInspection/SheetInspection/InspectResult
// (Go, inspect.go) field-for-field. Served by POST /report-definitions/
// preview with inspect: true instead of the rendered file — see
// reportsApi.inspect below.
export interface ElementInspection {
  id: string
  name?: string
  kind: string
  authored: BlockLayout
  resolved: BlockLayout
}

export interface SheetInspection {
  id: string
  name: string
  row_count: number
  col_count: number
  elements: ElementInspection[]
  overlaps?: { row: number; col: number }[]
  dropped_merges?: { start_row: number; end_row: number; start_col: number; end_col: number }[]
  diagnostics?: Diagnostic[]
}

export interface InspectResult {
  format: ExportFormat
  // GridDiagnostics/GridDiagnosticsNote's own Go doc comment covers why
  // overlaps/dropped_merges/diagnostics can be legitimately empty for a
  // format that doesn't render through the shared positioned grid (XLSX,
  // CSV, XLS) rather than meaning "nothing was found."
  grid_diagnostics: boolean
  grid_diagnostics_note?: string
  sheets: SheetInspection[]
}

// Mirrors internal/reports.FormatCapabilities + ReportFormatCapabilities
// (Go) field-for-field. Served by GET /meta/catalog's reports.
// renderer_capabilities — a small slice of a much larger platform-wide
// catalog response, so this type only names the one field this feature
// reads rather than modeling the whole Catalog shape.
//
// KNOWN LIMITATION (RF-301): the backend builds this from
// reports.AllRendererCapabilities(), the package-global default writer set
// — it has no reference to a deployment's actual *reports.Engine, so it
// cannot see an EngineOptions.Writers[FormatPDF] override. In a
// REPORT_PDF_RENDERER=chromium deployment, this endpoint still reports
// PDF's page_setup/repeat_rows/page_numbering/watermark as false even
// though that deployment's real PDF output honors all four (see
// chromiumPDFWriter.Capabilities() in chromium_pdf.go). Fixing this
// properly means threading the composition root's Engine into api/meta's
// Handler — out of scope here; RendererCapabilitiesNote below phrases the
// PDF caveat instead of silently shipping the wrong claim.
export interface ReportFormatCapability {
  format: ExportFormat
  per_cell_style: 'full' | 'partial' | 'none'
  merges: 'real' | 'degraded' | 'none'
  images_embed: boolean
  column_widths: boolean
  padding: boolean
  live_formulas: boolean
  row_heights: 'exact' | 'minimum' | 'none'
  freeze: boolean
  page_setup: boolean
  repeat_rows: boolean
  page_numbering: boolean
  watermark: boolean
}

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

// A slice of GET /meta/catalog, not a report-definitions endpoint — kept in
// this file anyway since reports is (as of RF-301) the only feature that
// reads it. See ReportFormatCapability's own doc comment for the shape and
// its one known staleness gap.
export const metaApi = {
  rendererCapabilities: async (): Promise<ReportFormatCapability[]> => {
    const catalog = await api.get('meta/catalog').json<{ reports?: { renderer_capabilities?: ReportFormatCapability[] } }>()
    return catalog.reports?.renderer_capabilities ?? []
  },
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
    signal?: AbortSignal,
  ): Promise<PreviewResult> => {
    const res = await api.post('report-definitions/preview', {
      json: { definition, format, arguments: argumentValues },
      signal,
    })
    const blob = await res.blob()
    const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), 'report')
    const rowCount = Number(res.headers.get('X-Report-Row-Count') ?? '0')
    return { blob, filename, rowCount }
  },

  // The SAME endpoint as preview() above, with inspect: true — the response
  // is JSON layout/diagnostic facts (InspectResult) instead of the rendered
  // file's bytes (api/reports/handler.go's Preview branches on req.Inspect).
  // RF-304's diagnostics panel is the first frontend caller; nothing called
  // this endpoint's inspect path before it.
  inspect: (
    definition: ReportDefinition,
    format?: ExportFormat,
    argumentValues?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<InspectResult> =>
    api.post('report-definitions/preview', {
      json: { definition, format, arguments: argumentValues, inspect: true },
      signal,
    }).json<InspectResult>(),

  // Resolves a SAVED report into its on-screen JSON shape (api/reports/
  // handler.go's Runtime) — the "report" menu type's own runtime viewer.
  // Unlike preview() above, this reads a report_definitions row server-side
  // by id rather than carrying the definition inline, and its own
  // authorization (reports.CallerPassesVisibility) is what decides whether
  // this call succeeds — an ordinary application:read caller, not just a
  // report author, can call this.
  runtime: (id: string, argumentValues?: Record<string, unknown>) =>
    api.post(`report-definitions/${id}/runtime`, { json: { arguments: argumentValues } }).json<RuntimeReportResult>(),

  // Renders a SAVED report into a downloadable file at the caller's current
  // argument values (api/reports/handler.go's Export) — the runtime
  // viewer's own Download button. Same viewer-level authorization as
  // runtime() above (reports.CallerPassesVisibility, not application:design),
  // but streams real rendered bytes through the same Engine.Generate path
  // preview() uses, so the shape of this call mirrors preview() rather than
  // runtime(): a Blob + filename + row count, not JSON.
  export: async (
    id: string,
    format?: ExportFormat,
    argumentValues?: Record<string, unknown>,
  ): Promise<PreviewResult> => {
    const res = await api.post(`report-definitions/${id}/export`, {
      json: { arguments: argumentValues, format },
    })
    const blob = await res.blob()
    const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), 'report')
    const rowCount = Number(res.headers.get('X-Report-Row-Count') ?? '0')
    return { blob, filename, rowCount }
  },
}
