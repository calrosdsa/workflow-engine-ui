import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react'
import type { WidgetRendererProps } from '../../widget-contract'
import type { ChartWidgetConfig } from './schema'
import { useChartData } from './useChartData'
import { useForm } from '@/features/forms/hooks'
import { formatNumber } from '@/features/forms/runtime/format-value'
import type { NumberFormat } from '@/features/forms/types'

// Categorical palette fallback (docs/dashboard-system-plan.md section 5.3) —
// no shared chart-color tokens exist yet in index.css, so this is a small,
// self-contained default rather than inventing app-wide theme
// infrastructure for this one widget. A per-series `color` override (see
// ChartSeries.color) always wins over this fallback.
const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6']

function seriesColor(config: ChartWidgetConfig, index: number): string {
  return config.series[index]?.color ?? PALETTE[index % PALETTE.length]
}

function seriesLabel(config: ChartWidgetConfig, index: number): string {
  const s = config.series[index]
  if (s?.label) return s.label
  if (!s) return `val_${index}`
  return s.fn === 'count' ? 'Count' : `${s.fn}(${s.field ?? ''})`
}

export function ChartRenderer({ config }: WidgetRendererProps<ChartWidgetConfig>) {
  const { data, isLoading, isError } = useChartData(config)
  // A stat tile's single series names a source field (every aggregate but
  // 'count' does) whose own number_format — money, a percentage, a plain
  // grouped number — is the same setting that field's own records use (see
  // FieldDef.number_format's doc comment). Fetched unconditionally (hooks
  // can't be conditional) but only ENABLED for a stat tile with a formId, so
  // every other chart type never issues this request; useForm's queryKey is
  // keyed by formId alone, so multiple stat tiles on the same form share one
  // cache entry rather than each re-fetching it.
  const isStat = config.chartType === 'stat'
  const { data: sourceForm } = useForm(isStat ? (config.formId ?? '') : '')

  const needsGroupBy = config.chartType !== 'stat'
  if (!config.formId || (needsGroupBy && !config.groupBy?.field)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <BarChart3 size={18} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {needsGroupBy ? 'Choose a form and a field to group by.' : 'Choose a form to aggregate.'}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={18} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
        <AlertCircle size={18} style={{ color: 'hsl(var(--destructive))' }} />
        <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>Couldn't load chart data.</p>
      </div>
    )
  }

  const groups = data?.groups ?? []
  if (groups.length === 0) {
    return <div className="flex h-full items-center justify-center p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No data yet.</div>
  }

  if (isStat) {
    const sourceFieldName = config.series[0]?.field
    const numberFormat = sourceForm?.fields.find((f) => f.name === sourceFieldName)?.number_format
    return <StatTile config={config} value={groups[0]?.values[0] ?? 0} numberFormat={numberFormat} />
  }

  // Recharts consumes plain objects keyed by name — "key" for the x-axis /
  // pie label, "val_0".."val_n" for each series, matching the backend's own
  // positional val_N aliasing (aggregate.go) so no name-based lookup is
  // needed between the two.
  const rows = groups.map((g) => {
    const row: Record<string, string | number> = { key: g.key }
    g.values.forEach((v, i) => { row[`val_${i}`] = v })
    return row
  })

  if (config.chartType === 'pie') {
    return (
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
  }

  const ChartComponent = config.chartType === 'line' ? LineChart : config.chartType === 'area' ? AreaChart : BarChart

  return (
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

function StatTile({ config, value, numberFormat }: { config: ChartWidgetConfig; value: number; numberFormat?: NumberFormat }) {
  const formatted = formatNumber(value, numberFormat)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
      <span className="text-3xl font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{formatted}</span>
      <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{seriesLabel(config, 0)}</span>
    </div>
  )
}
