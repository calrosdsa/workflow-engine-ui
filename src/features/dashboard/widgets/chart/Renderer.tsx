import { useState, type ReactNode } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetRendererProps } from '../../widget-contract'
import { DATE_FIELD_TYPES, type ChartWidgetConfig } from './schema'
import { useChartData } from './useChartData'
import { stripBucketSortPrefix } from './bucket-label'
import { mergeFilters, rangeToConditions } from './runtime-filter'
import type { DateRange } from './date-range'
import { RuntimeToolbar } from './RuntimeToolbar'
import { ChartMenu } from './ChartMenu'
import { useForm } from '@/features/forms/hooks'
import { formatNumber } from '@/features/forms/runtime/format-value'
import type { NumberFormat, FieldType } from '@/features/forms/types'
import type { DateBucket } from '@/features/forms/api'
import type { FilterGroup } from '@/features/workflows/types'

// Categorical palette fallback (docs/dashboard-system-plan.md section 5.3) —
// no shared chart-color tokens exist yet in index.css, so this is a small,
// self-contained default rather than inventing app-wide theme
// infrastructure for this one widget. A per-series `color` override (see
// ChartSeries.color) always wins over this fallback.
const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6']

function seriesColor(config: ChartWidgetConfig, index: number): string {
  return config.series[index]?.color ?? PALETTE[index % PALETTE.length]
}

// Not translated: this feeds export-csv.ts's CSV column headers via a free
// function outside React, and the sibling branch (`${fn}(${field})`) is raw,
// untranslatable technical content — translating only the 'count' case would
// produce a header row that's half-Spanish. Same exclusion class as
// FORMAT_LABELS (reports/ReportSettingsPanel.tsx) and argument.label.
export function seriesLabel(config: ChartWidgetConfig, index: number): string {
  const s = config.series[index]
  if (s?.label) return s.label
  if (!s) return `val_${index}`
  return s.fn === 'count' ? 'Count' : `${s.fn}(${s.field ?? ''})`
}

export function ChartRenderer({ config, clientId, appId, menus, mode, parameterFilter }: WidgetRendererProps<ChartWidgetConfig>) {
  const t = useTranslation()
  const isRuntime = mode === 'runtime'
  const isStat = config.chartType === 'stat'
  const needsGroupBy = config.chartType !== 'stat'

  // Live, viewer-only overrides — never persisted, never sent anywhere
  // except as ordinary aggregate-request parameters. Reset to unset
  // whenever the whole widget instance remounts (dashboard navigation
  // already remounts on menu change — see RuntimeAppShell's key={menu.id}
  // comment — so "leave and come back" already resets these for free).
  const [liveBucket, setLiveBucket] = useState<DateBucket | undefined>(undefined)
  const [liveRange, setLiveRange] = useState<DateRange | undefined>(undefined)
  const [adhocFilter, setAdhocFilter] = useState<FilterGroup | undefined>(undefined)

  // Fetched unconditionally now (previously gated to isStat-only) — the
  // runtime toolbar needs `fields` too, to gate the time-range/bucket
  // controls on the groupBy field's type and to feed the ad-hoc
  // FilterBuilder. useForm's queryKey is keyed by formId alone, so this
  // shares one cache entry with the ConfigPanel's own useForm(config.formId)
  // call and with sibling chart tiles on the same form.
  const { data: sourceForm } = useForm(config.formId ?? '')
  const fields = sourceForm?.fields ?? []

  const showTimeControls = isRuntime && !!config.groupBy?.field
    && DATE_FIELD_TYPES.includes(fields.find((f) => f.name === config.groupBy?.field)?.type as FieldType)

  // A time range only has a field to apply to when the toolbar is actually
  // showing one (see showTimeControls above) — config.groupBy.field is
  // guaranteed set and date-typed in that case.
  const rangeFilterGroup: FilterGroup | undefined = showTimeControls && liveRange && config.groupBy
    ? { combinator: 'and', conditions: rangeToConditions(config.groupBy.field, liveRange), groups: [] }
    : undefined

  // The single effective config every live control feeds into — builder
  // mode (ConfigPanel's own preview) never computes this and always passes
  // the raw `config` straight through, so the two paths cannot diverge in
  // how a request gets built; useChartData/buildAggregateRequest are
  // otherwise completely unmodified by this whole feature.
  // The dashboard's parameters narrow this tile the same way the viewer's own
  // toolbar overrides do: ANDed on top of the authored filter, never
  // replacing it. Resolved upstream in RuntimeGrid, so this widget never sees
  // a binding or a raw parameter value.
  const effectiveFilter = mergeFilters(config.filter, parameterFilter, rangeFilterGroup, adhocFilter)
  const effectiveConfig: ChartWidgetConfig = isRuntime
    ? {
        ...config,
        groupBy: config.groupBy ? { ...config.groupBy, bucket: liveBucket ?? config.groupBy.bucket } : undefined,
        filter: effectiveFilter,
      }
    : config

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useChartData(effectiveConfig)
  const groups = data?.groups ?? []

  // Per-measure formats, straight off the result. Before the response
  // described its own columns, the only way to format a value was to go back
  // to the form definition and guess which field produced it — which is why
  // this used to work on a stat tile and nowhere else. Optional because an
  // older backend (or a cached response) simply has no columns, in which case
  // every number renders raw exactly as it used to.
  const measureFormats = (data?.columns ?? []).filter((c) => c.role === 'measure').map((c) => c.number_format)

  const formatMeasure = (value: unknown, index: number) =>
    typeof value === 'number' ? formatNumber(value, measureFormats[index]) : String(value ?? '')

  // Recharts hands the tooltip the series' dataKey, which is this widget's
  // own positional "val_N" — so each series formats with ITS own measure.
  // dataKey is widened by recharts to include an accessor function; this
  // widget only ever sets the string form, so anything else falls back to 0.
  const tooltipFormatter = (value: unknown, _name: unknown, item?: { dataKey?: unknown }) => {
    const raw = item?.dataKey
    const key = typeof raw === 'string' ? raw : ''
    const i = key.startsWith('val_') ? Number(key.slice(4)) : 0
    return formatMeasure(value, Number.isFinite(i) ? i : 0)
  }

  // A single Y axis cannot speak two units, so it formats only when every
  // measure agrees. With a mixed set the ticks stay raw rather than silently
  // labelling all of them with the first series' currency.
  const axisFormat = measureFormats.length > 0
    && measureFormats.every((f) => JSON.stringify(f ?? null) === JSON.stringify(measureFormats[0] ?? null))
    ? measureFormats[0]
    : undefined

  let content: ReactNode
  if (!config.formId || (needsGroupBy && !config.groupBy?.field)) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <BarChart3 size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {needsGroupBy ? t('builder.dashboard_chart.choose_form_field') : t('builder.dashboard_chart.choose_form')}
        </p>
      </div>
    )
  } else if (isLoading) {
    content = (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={18} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
      </div>
    )
  } else if (isError) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <AlertCircle size={18} style={{ color: 'hsl(var(--destructive))' }} />
        <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{t('builder.dashboard_chart.load_error')}</p>
      </div>
    )
  } else if (groups.length === 0) {
    content = <div className="flex h-full items-center justify-center p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('builder.dashboard_chart.no_data')}</div>
  } else if (isStat) {
    const sourceFieldName = config.series[0]?.field
    // The column descriptor is authoritative; the form-definition lookup
    // stays as the fallback for a backend that does not send columns yet.
    const numberFormat = measureFormats[0]
      ?? sourceForm?.fields.find((f) => f.name === sourceFieldName)?.number_format
    content = <StatTile config={config} value={groups[0]?.values[0] ?? 0} numberFormat={numberFormat} />
  } else {
    // Recharts consumes plain objects keyed by name — "key" for the x-axis /
    // pie label, "val_0".."val_n" for each series, matching the backend's
    // own positional val_N aliasing (aggregate.go) so no name-based lookup
    // is needed between the two.
    const rows = groups.map((g) => {
      const row: Record<string, string | number> = { key: stripBucketSortPrefix(g.key) }
      g.values.forEach((v, i) => { row[`val_${i}`] = v })
      return row
    })

    if (config.chartType === 'pie') {
      content = (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="val_0" nameKey="key" outerRadius="80%" label isAnimationActive={false}>
              {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={tooltipFormatter} />
            {config.legend && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      )
    } else {
      const ChartComponent = config.chartType === 'line' ? LineChart : config.chartType === 'area' ? AreaChart : BarChart
      content = (
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="key" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals tickFormatter={(v) => formatNumber(Number(v), axisFormat)} />
            <Tooltip formatter={tooltipFormatter} />
            {config.legend && <Legend />}
            {config.series.map((_, i) => {
              const color = seriesColor(config, i)
              const label = seriesLabel(config, i)
              if (config.chartType === 'line') {
                return <Line key={i} type="monotone" dataKey={`val_${i}`} name={label} stroke={color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              }
              if (config.chartType === 'area') {
                return <Area key={i} type="monotone" dataKey={`val_${i}`} name={label} stroke={color} fill={color} fillOpacity={0.25} isAnimationActive={false} />
              }
              return <Bar key={i} dataKey={`val_${i}`} name={label} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            })}
          </ChartComponent>
        </ResponsiveContainer>
      )
    }
  }

  // Nothing meaningful for any runtime control to do until the widget is
  // actually configured (no formId yet) — an author-in-progress state a
  // published dashboard would never actually show a viewer.
  const showRuntimeChrome = isRuntime && !!config.formId

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showRuntimeChrome && (
        <RuntimeToolbar
          fields={fields}
          showTimeControls={showTimeControls}
          bucket={liveBucket ?? config.groupBy?.bucket}
          onBucketChange={setLiveBucket}
          range={liveRange}
          onRangeChange={setLiveRange}
          adhocFilter={adhocFilter}
          onAdhocFilterChange={setAdhocFilter}
          dataUpdatedAt={dataUpdatedAt}
          menuSlot={(
            <ChartMenu
              config={config}
              clientId={clientId}
              appId={appId}
              menus={menus}
              groups={groups}
              sourceFormName={sourceForm?.name}
              effectiveFilter={effectiveFilter}
              onRefresh={() => refetch()}
              onReset={() => { setLiveBucket(undefined); setLiveRange(undefined); setAdhocFilter(undefined) }}
            />
          )}
        />
      )}
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  )
}

function StatTile({ config, value, numberFormat }: { config: ChartWidgetConfig; value: number; numberFormat?: NumberFormat }) {
  const formatted = formatNumber(value, numberFormat)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
      <span className="text-3xl font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{formatted}</span>
      <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{seriesLabel(config, 0)}</span>
    </div>
  )
}
