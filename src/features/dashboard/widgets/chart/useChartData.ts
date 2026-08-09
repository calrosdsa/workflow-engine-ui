import { useQuery } from '@tanstack/react-query'
import { formsApi } from '@/features/forms/api'
import type { AggregateRecordsRequest } from '@/features/forms/api'
import type { ChartWidgetConfig } from './schema'

/** Builds the aggregate request from a chart config — shared by the
 *  Renderer and the ConfigPanel's live preview so the two can never
 *  interpret the same config differently.
 *
 *  A 'stat' chart needs no group_by at all (a single aggregate number over
 *  the whole filtered table); every other chart type needs one (there's no
 *  bar/line/pie/area without a dimension to plot against) — this is the one
 *  place that distinction is enforced, matching the backend's own
 *  GroupBy *AggregateDimension (nil = ungrouped) contract.
 *
 *  A config with no series at all still needs a request shape the backend
 *  accepts; server-side AggregateRecords already defaults an empty series
 *  list to COUNT(*), so this doesn't duplicate that fallback — it only
 *  omits `series` in that case, letting the backend's own default take
 *  over. */
export function buildAggregateRequest(config: ChartWidgetConfig): AggregateRecordsRequest | null {
  if (!config.formId) return null
  if (config.chartType !== 'stat' && !config.groupBy?.field) return null

  return {
    group_by: config.groupBy?.field ? { field: config.groupBy.field, bucket: config.groupBy.bucket } : undefined,
    group_by2: config.groupBy2?.field ? { field: config.groupBy2.field, bucket: config.groupBy2.bucket } : undefined,
    series: config.series.length > 0 ? config.series.map((s) => ({ fn: s.fn, field: s.field })) : undefined,
    filter: config.filter,
    sort_by: config.sortBy,
    sort_dir: config.sortDir,
    limit: config.limit,
  }
}

export function useChartData(config: ChartWidgetConfig) {
  const req = buildAggregateRequest(config)
  return useQuery({
    queryKey: ['forms', config.formId, 'aggregate', req],
    queryFn: () => formsApi.aggregateRecords(config.formId, req!),
    enabled: !!req,
    refetchInterval: config.refreshSeconds ? config.refreshSeconds * 1000 : false,
  })
}
