import { useState, type ReactNode } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  ComposedChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LabelList,
} from 'recharts'
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import {
  CARTESIAN_TYPES, ORIENTABLE_TYPES, STACKABLE_TYPES,
  DATE_FIELD_TYPES, type ChartWidgetConfig,
} from './schema'
import {
  PALETTE, buildFlatPlot, buildSplitPlot, canUseLog, hasSplit, logFloor,
  plottedValues, seriesLabel, type PlotSeries,
} from './plot'
import type { WidgetRendererProps } from '../../widget-contract'
import { useChartData } from './useChartData'
import { mergeFilters, rangeToConditions } from './runtime-filter'
import type { DateRange } from './date-range'
import { RuntimeToolbar } from './RuntimeToolbar'
import { ChartMenu } from './ChartMenu'
import { useForm } from '@/features/forms/hooks'
import { formatNumber } from '@/features/forms/runtime/format-value'
import type { NumberFormat, FieldType } from '@/features/forms/types'
import type { DateBucket } from '@/features/forms/api'
import type { FilterGroup } from '@/features/workflows/types'

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

  // A second dimension is drawable only on a chart with a category axis; a
  // pie split into sub-slices is just a pie of the pairs.
  const isSplit = CARTESIAN_TYPES.includes(config.chartType) && hasSplit(groups)
  const { rows, series: plotSeries } = isSplit
    ? buildSplitPlot(config, groups)
    : buildFlatPlot(config, groups)
  // A split spends the colour channel on the split values, so measures past
  // the first cannot be drawn. Told to the viewer rather than dropped in
  // silence — the failure mode §2.6 of the analytics R&D is about.
  const droppedSeries = isSplit ? Math.max(0, config.series.length - 1) : 0

  // Per-measure formats, straight off the result. Before the response
  // described its own columns, the only way to format a value was to go back
  // to the form definition and guess which field produced it — which is why
  // this used to work on a stat tile and nowhere else. Optional because an
  // older backend (or a cached response) simply has no columns, in which case
  // every number renders raw exactly as it used to.
  const measureFormats = (data?.columns ?? []).filter((c) => c.role === 'measure').map((c) => c.number_format)

  const formatMeasure = (value: unknown, index: number) =>
    typeof value === 'number' ? formatNumber(value, measureFormats[index]) : String(value ?? '')

  // Recharts hands the tooltip the series' dataKey, which this widget owns
  // either way — so the plot itself says which measure to format with,
  // rather than the key being re-parsed here. dataKey is widened by recharts
  // to include an accessor function; this widget only ever sets the string
  // form, so anything else falls back to the first measure.
  const tooltipFormatter = (value: unknown, _name: unknown, item?: { dataKey?: unknown }) => {
    const raw = item?.dataKey
    const match = typeof raw === 'string' ? plotSeries.find((p) => p.dataKey === raw) : undefined
    return formatMeasure(value, match?.measureIndex ?? 0)
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
  } else if (config.chartType === 'pie' || config.chartType === 'donut') {
    // A donut is a pie with the middle removed — the one difference between
    // the two, which is why they share this branch rather than a type each.
    content = (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="val_0"
            nameKey="key"
            outerRadius="80%"
            innerRadius={config.chartType === 'donut' ? '55%' : undefined}
            // Slice labels are ALWAYS on here, as they have been; dataLabels
            // upgrades them from the category name to the formatted value
            // rather than switching them on, so no existing pie loses its
            // labels by not having opted in.
            label={config.dataLabels ? (e: { value?: number }) => formatMeasure(e.value, 0) : true}
            isAnimationActive={false}
          >
            {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={tooltipFormatter} />
          {config.legend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    )
  } else {
    const horizontal = ORIENTABLE_TYPES.includes(config.chartType) && config.orientation === 'horizontal'
    // Recharts names its layout after the CATEGORY axis's direction, which
    // is the opposite of how the chart reads: bars that run left-to-right
    // are layout="vertical". Translated here, once.
    const rechartsLayout = horizontal ? 'vertical' : 'horizontal'
    const stacked = config.stacked === true && STACKABLE_TYPES.includes(config.chartType)

    // Both log decisions are made from the plotted values and live in
    // plot.ts, where they are pinned by tests — the floor in particular had
    // to be taken away from recharts, and that is easy to regress.
    const plotted = plottedValues({ rows, series: plotSeries })
    const useLog = config.axis?.yLog === true && canUseLog(plotted)

    const { yMin, yMax, xTitle, yTitle } = config.axis ?? {}
    const bounded = yMin !== undefined || yMax !== undefined
    const domain: [number | string, number | string] | undefined =
      bounded || useLog ? [yMin ?? (useLog ? logFloor(plotted) : 0), yMax ?? 'auto'] : undefined

    const valueAxis = {
      type: 'number' as const,
      tick: { fontSize: 11 },
      allowDecimals: true,
      tickFormatter: (v: unknown) => formatNumber(Number(v), axisFormat),
      // allowDataOverflow only where the author actually asked for bounds —
      // it tells recharts to CLIP to the domain, and on the log axis's
      // automatic domain that quietly drops the smallest bar off the chart
      // instead of scaling to fit it.
      ...(domain ? { domain } : {}),
      ...(bounded ? { allowDataOverflow: true } : {}),
      ...(useLog ? { scale: 'log' as const } : {}),
      ...(yTitle ? { label: { value: yTitle, angle: -90, position: 'insideLeft' as const, style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } } } : {}),
    }
    const categoryAxis = {
      type: 'category' as const,
      dataKey: 'key',
      tick: { fontSize: 11 },
      ...(xTitle ? { label: { value: xTitle, position: 'insideBottom' as const, offset: -4, style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } } } : {}),
    }

    // Combo is the only type whose marks differ per series, so it is the
    // only one needing the composed container; the rest keep their own
    // dedicated chart so nothing changes for a chart authored before this.
    const ChartComponent = config.chartType === 'combo' ? ComposedChart
      : config.chartType === 'line' ? LineChart
      : config.chartType === 'area' ? AreaChart
      : BarChart

    const labelPosition = stacked ? 'center' : horizontal ? 'right' : 'top'
    const dataLabel = (s: PlotSeries) => config.dataLabels && (
      <LabelList
        dataKey={s.dataKey}
        position={labelPosition}
        style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
        formatter={(v: unknown) => formatMeasure(v, s.measureIndex)}
      />
    )

    content = (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={rows}
          layout={rechartsLayout}
          // Data labels sit just outside their mark, so they need room the
          // default margin does not leave: above the tallest bar, or to the
          // right of the longest one.
          margin={{
            top: config.dataLabels && !horizontal ? 20 : 8,
            right: config.dataLabels && horizontal ? 44 : 8,
            left: yTitle ? 8 : 0,
            bottom: xTitle ? 16 : 8,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          {horizontal
            ? <><XAxis {...valueAxis} /><YAxis {...categoryAxis} width={90} /></>
            : <><XAxis {...categoryAxis} /><YAxis {...valueAxis} /></>}
          <Tooltip formatter={tooltipFormatter} />
          {config.legend && <Legend />}
          {plotSeries.map((s, i) => {
            // One stackId for everything means "stack together"; leaving it
            // undefined is what makes a chart grouped.
            const stackId = stacked ? 'stack' : undefined
            const mark = config.chartType === 'combo' ? s.type
              : config.chartType === 'line' ? 'line'
              : config.chartType === 'area' ? 'area'
              : 'bar'
            if (mark === 'line') {
              return (
                <Line key={i} type="monotone" dataKey={s.dataKey} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}>
                  {dataLabel(s)}
                </Line>
              )
            }
            if (mark === 'area') {
              return (
                <Area key={i} type="monotone" dataKey={s.dataKey} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.25} stackId={stackId} isAnimationActive={false}>
                  {dataLabel(s)}
                </Area>
              )
            }
            return (
              // A stacked bar's rounded cap belongs only on the topmost
              // segment, and which segment that is varies per column — so
              // stacking squares them all off rather than drawing a rounded
              // edge in the middle of a stack.
              <Bar key={i} dataKey={s.dataKey} name={s.label} fill={s.color} radius={stacked ? undefined : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} stackId={stackId} isAnimationActive={false}>
                {dataLabel(s)}
              </Bar>
            )
          })}
        </ChartComponent>
      </ResponsiveContainer>
    )
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
      {droppedSeries > 0 && (
        <p className="shrink-0 px-2 pb-1 text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {t('builder.dashboard_chart.split_extra_series', { n: droppedSeries })}
        </p>
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
