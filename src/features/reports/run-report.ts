import { reportsApi } from './api'
import type { ExportFormat, ReportDefinition, WorkbookCell } from './types'

// Every run surface downloads a file — there is no on-screen viewer, by
// explicit decision (FR-D2-019 RUN-05). Shared here so the report list's Run
// action and the builder's Preview button perform the identical request and
// download, rather than each reimplementing the blob dance.

export interface RunReportResult {
  filename: string
  rowCount: number
}

/**
 * True when definition has anything a run/preview could actually render —
 * a block (data-backed, text, or image), OR a static workbook cell with a
 * real value or formula. A report with zero blocks but a hand-authored
 * workbook of static cells (no data source needed at all) is real,
 * renderable content — the backend already renders it fine (there is no
 * emptiness check anywhere in Engine.Generate). Found live, 2026-09-06:
 * PreviewButton's own guard checked `blocks.length` alone and rejected
 * exactly that kind of report as "empty" before ever calling the backend.
 */
export function hasRenderableContent(definition: ReportDefinition): boolean {
  if (definition.blocks.length > 0) return true
  return (definition.workbook?.sheets ?? []).some((sheet) => (sheet.cells ?? []).some(isNonBlankCell))
}

function isNonBlankCell(cell: WorkbookCell): boolean {
  if (cell.formula) return true
  return cell.value !== undefined && cell.value !== null && String(cell.value) !== ''
}

/**
 * Generates a report and hands the file to the browser.
 *
 * Format falls back to the report's own configured default, then to CSV — a
 * report still being designed very plausibly has no export format set yet,
 * and failing a run for that reason would be a confusing dead end.
 */
export async function runReportToDownload(
  definition: ReportDefinition,
  argumentValues?: Record<string, unknown>,
  format?: ExportFormat,
): Promise<RunReportResult> {
  const resolvedFormat = format ?? definition.settings.default_format ?? 'csv'
  const { blob, filename, rowCount } = await reportsApi.preview(definition, resolvedFormat, argumentValues)

  // Standard client-side download: an object URL handed to a throwaway,
  // never-appended <a download>, revoked immediately so the blob is not held
  // in memory past this one download.
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)

  return { filename, rowCount }
}
