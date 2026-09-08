import { useState, type ReactNode } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react'
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

export function seriesLabel(config: ChartWidgetConfig, index: number): string {
  const s = config.series[index]
  if (s?.label) return s.label
  if (!s) return `val_${index}`
  return s.fn === 'count' ? 'Count' : `${s.fn}(${s.field ?? ''})`
}

export function ChartRenderer({ config, clientId, appId, menus, mode }: WidgetRendererProps<ChartWidgetConfig>) {
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
  const effectiveFilter = mergeFilters(config.filter, rangeFilterGroup, adhocFilter)
  const effectiveConfig: ChartWidgetConfig = isRuntime
    ? {
        ...config,
        groupBy: config.groupBy ? { ...config.groupBy, bucket: liveBucket ?? config.groupBy.bucket } : undefined,
        filter: effectiveFilter,
      }
    : config

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useChartData(effectiveConfig)
  const groups = data?.groups ?? []

  let content: ReactNode
  if (!config.formId || (needsGroupBy && !config.groupBy?.field)) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <BarChart3 size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {needsGroupBy ? 'Choose a form and a field to group by.' : 'Choose a form to aggregate.'}
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
        <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>Couldn't load chart data.</p>
      </div>
    )
  } else if (groups.length === 0) {
    content = <div className="flex h-full items-center justify-center p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No data yet.</div>
  } else if (isStat) {
    const sourceFieldName = config.series[0]?.field
    const numberFormat = sourceForm?.fields.find((f) => f.name === sourceFieldName)?.number_format
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
            <Tooltip />
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
            <YAxis tick={{ fontSize: 11 }} allowDecimals />
            <Tooltip />
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
