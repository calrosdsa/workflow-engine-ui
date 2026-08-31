import { BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, PieChart as PieChartIcon, Hash, Plus, Trash2 } from 'lucide-react'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForm } from '@/features/forms/hooks'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { ChartWidgetConfig, ChartType, ChartSeries } from './schema'
import type { AggregateFn, DateBucket } from '@/features/forms/api'
import type { FieldDef, FieldType } from '@/features/forms/types'
import { ChartRenderer } from './Renderer'

// Field-type gating: any field can be a dimension (group_by) — enum/string/
// boolean/reference/date all make sensible x-axis categories — but a date/
// datetime dimension additionally unlocks the bucket picker, and a measure
// (sum/avg/min/max) is only offered numeric fields, mirroring
// workflow-engine's own numericTypes/bucketableTypes gate in aggregate.go so
// the UI never lets a user configure something the backend would reject.
const NUMERIC_TYPES: FieldType[] = ['integer', 'decimal']
const DATE_TYPES: FieldType[] = ['date', 'datetime']

const CHART_TYPE_OPTIONS: Array<{ value: ChartType; label: string; icon: typeof BarChart3 }> = [
  { value: 'bar', label: 'Bar', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: LineChartIcon },
  { value: 'area', label: 'Area', icon: AreaChartIcon },
  { value: 'pie', label: 'Pie', icon: PieChartIcon },
  { value: 'stat', label: 'Stat', icon: Hash },
]

const FN_LABELS: Record<AggregateFn, string> = { count: 'Count', sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max' }
const BUCKET_LABELS: Record<DateBucket, string> = { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' }

export function ChartConfigPanel({ config, onChange }: WidgetConfigPanelProps<ChartWidgetConfig>) {
  const { data: form } = useForm(config.formId)
  const fields = form?.fields ?? []
  const numericFields = fields.filter((f) => NUMERIC_TYPES.includes(f.type))

  const patch = (p: Partial<ChartWidgetConfig>) => onChange({ ...config, ...p })

  const needsGroupBy = config.chartType !== 'stat'
  const supportsGroupBy2 = config.chartType === 'bar' || config.chartType === 'line' || config.chartType === 'area'

  const addSeries = () => patch({ series: [...config.series, { fn: 'count' }] })
  const updateSeries = (index: number, s: Partial<ChartSeries>) =>
    patch({ series: config.series.map((cur, i) => (i === index ? { ...cur, ...s } : cur)) })
  const removeSeries = (index: number) => patch({ series: config.series.filter((_, i) => i !== index) })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Form</Label>
        <FormReferenceSelect value={config.formId} onChange={(formId) => patch({ formId: formId ?? '' })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Chart type</Label>
        <div className="grid grid-cols-5 gap-1">
          {CHART_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => patch({ chartType: value })}
              className={`flex flex-col items-center gap-1 rounded-md border py-1.5 text-[10px] font-medium transition-colors ${
                config.chartType === value ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
              title={label}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {form && needsGroupBy && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Group by</Label>
          <FieldSelect
            fields={fields}
            value={config.groupBy?.field ?? ''}
            onChange={(f) => patch({ groupBy: f ? { field: f } : undefined })}
          />
          {config.groupBy?.field && DATE_TYPES.includes(fields.find((f) => f.name === config.groupBy?.field)?.type as FieldType) && (
            <BucketSelect
              value={config.groupBy.bucket}
              onChange={(bucket) => patch({ groupBy: { ...config.groupBy!, bucket } })}
            />
          )}
        </div>
      )}

      {form && needsGroupBy && supportsGroupBy2 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Split by (optional 2nd dimension)</Label>
          <FieldSelect
            fields={fields}
            value={config.groupBy2?.field ?? ''}
            onChange={(f) => patch({ groupBy2: f ? { field: f } : undefined })}
            allowNone
          />
        </div>
      )}

      {form && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
              {config.chartType === 'stat' ? 'Value' : 'Series'}
            </Label>
            {config.chartType !== 'stat' && (
              <button type="button" onClick={addSeries} className="flex items-center gap-1 text-[11px] text-[hsl(var(--primary))] hover:brightness-110">
                <Plus size={11} /> Add series
              </button>
            )}
          </div>
          {config.series.map((s, i) => (
            <SeriesEditor
              key={i}
              series={s}
              numericFields={numericFields}
              onChange={(patch) => updateSeries(i, patch)}
              onRemove={config.series.length > 1 ? () => removeSeries(i) : undefined}
            />
          ))}
          {config.series.length === 0 && (
            <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-2 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
              No series — defaults to a plain count.
            </p>
          )}
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Filter</Label>
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={form.fields}
            variables={[]}
            onChange={(g) => patch({ filter: g })}
          />
        </div>
      )}

      {needsGroupBy && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Sort by</Label>
            <SelectMenu value={config.sortBy} onValueChange={(v) => patch({ sortBy: v as ChartWidgetConfig['sortBy'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="group" className="text-xs">Group</SelectItem>
                <SelectItem value="value" className="text-xs">Value</SelectItem>
              </SelectContent>
            </SelectMenu>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Direction</Label>
            <SelectMenu value={config.sortDir} onValueChange={(v) => patch({ sortDir: v as ChartWidgetConfig['sortDir'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                <SelectItem value="desc" className="text-xs">Descending</SelectItem>
              </SelectContent>
            </SelectMenu>
          </div>
        </div>
      )}

      {needsGroupBy && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Max groups shown</Label>
          <Input type="number" min={1} max={200} value={config.limit} onChange={(e) => patch({ limit: Number(e.target.value) || 20 })} className="h-8 w-24 text-sm" />
        </div>
      )}

      {config.chartType !== 'pie' && (
        <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
          <Checkbox checked={config.legend} onCheckedChange={(c) => patch({ legend: c === true })} />
          Show legend
        </Label>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Auto-refresh (seconds, optional)</Label>
        <Input
          type="number"
          min={5}
          value={config.refreshSeconds ?? ''}
          onChange={(e) => patch({ refreshSeconds: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="Load once"
          className="h-8 w-28 text-sm"
        />
      </div>

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Preview</Label>
          <div className="h-48 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <ChartRenderer
              config={config}
              instance={{ id: 'preview', type: 'chart', layout: { x: 0, y: 0, w: 1, h: 1 }, chrome: 'plain', config }}
              clientId=""
              appId=""
              mode="builder"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FieldSelect({ fields, value, onChange, allowNone }: {
  fields: FieldDef[]
  value: string
  onChange: (field: string) => void
  allowNone?: boolean
}) {
  return (
    <SelectMenu value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a field…" /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none__" className="text-xs">None</SelectItem>}
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}

function BucketSelect({ value, onChange }: { value?: DateBucket; onChange: (bucket: DateBucket | undefined) => void }) {
  return (
    <SelectMenu value={value ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? undefined : (v as DateBucket))}>
      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No bucketing" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-xs">Exact value</SelectItem>
        {(Object.keys(BUCKET_LABELS) as DateBucket[]).map((b) => (
          <SelectItem key={b} value={b} className="text-xs">By {BUCKET_LABELS[b]}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}

function SeriesEditor({ series, numericFields, onChange, onRemove }: {
  series: ChartSeries
  numericFields: FieldDef[]
  onChange: (patch: Partial<ChartSeries>) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] p-2">
      <SelectMenu value={series.fn} onValueChange={(v) => onChange({ fn: v as AggregateFn, field: v === 'count' ? undefined : series.field })}>
        <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(FN_LABELS) as AggregateFn[]).map((fn) => (
            <SelectItem key={fn} value={fn} className="text-xs">{FN_LABELS[fn]}</SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
      {series.fn !== 'count' && (
        <SelectMenu value={series.field ?? ''} onValueChange={(v) => onChange({ field: v })}>
          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Field…" /></SelectTrigger>
          <SelectContent>
            {numericFields.map((f) => (
              <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
            ))}
            {numericFields.length === 0 && <SelectItem value="__none__" disabled className="text-xs">No numeric fields</SelectItem>}
          </SelectContent>
        </SelectMenu>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}
