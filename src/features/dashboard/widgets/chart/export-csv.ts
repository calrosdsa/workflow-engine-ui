import type { ChartWidgetConfig } from './schema'
import type { AggregateGroupResponse } from '@/features/forms/api'
import { seriesLabel } from './plot'
import { stripBucketSortPrefix } from './bucket-label'

function csvCell(value: unknown): string {
  const s = String(value ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Builds a CSV of exactly what the chart plots — the aggregate response
 *  already sitting in the TanStack Query cache, not a fresh raw-record
 *  export. Mirrors ERPNext's own chart "Export" (downloads the plotted
 *  series, not the underlying record table) and needs no extra request.
 *  A 'stat' tile has no group_by at all, so it gets a one-column,
 *  one-value CSV instead of a misleading empty "Group" column. */
export function buildChartCsv(config: ChartWidgetConfig, groups: AggregateGroupResponse[]): string {
  if (config.chartType === 'stat') {
    const header = [seriesLabel(config, 0)]
    const row = [groups[0]?.values[0] ?? 0]
    return [header, row].map((r) => r.map(csvCell).join(',')).join('\r\n')
  }

  const hasKey2 = groups.some((g) => g.key2 !== undefined)
  const header = [
    config.groupBy?.field ?? 'Group',
    ...(hasKey2 ? [config.groupBy2?.field ?? 'Group 2'] : []),
    ...config.series.map((_, i) => seriesLabel(config, i)),
  ]
  const rows = groups.map((g) => [
    stripBucketSortPrefix(g.key),
    ...(hasKey2 ? [g.key2 ? stripBucketSortPrefix(g.key2) : ''] : []),
    ...g.values,
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** Same object-URL/<a download>/revoke dance features/reports/run-report.ts
 *  uses for its own file download — small enough to duplicate here rather
 *  than import a report-specific helper cross-feature. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
