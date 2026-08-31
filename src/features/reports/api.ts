import { api } from '@/lib/api'
import type { ReportDefinitionRow, ReportDefinition, ExportFormat } from './types'

export interface CreateReportPayload {
  name: string
  definition: ReportDefinition
}

export interface PreviewResult {
  blob: Blob
  filename: string
  rowCount: number
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
}
