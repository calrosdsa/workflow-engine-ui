import { useState } from 'react'
import { BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, PieChart as PieChartIcon, Hash, Plus, Trash2 } from 'lucide-react'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { useCurrentUserAttrs } from '@/features/workflows/builder/useCurrentUserAttrs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForm } from '@/features/forms/hooks'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import { DATE_FIELD_TYPES, type ChartWidgetConfig, type ChartType, type ChartSeries } from './schema'
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

function chartTypeOptions(t: I18nContextValue['t']): Array<{ value: ChartType; label: string; icon: typeof BarChart3 }> {
  return [
    { value: 'bar', label: t('builder.dashboard_chart.type_bar'), icon: BarChart3 },
    { value: 'line', label: t('builder.dashboard_chart.type_line'), icon: LineChartIcon },
    { value: 'area', label: t('builder.dashboard_chart.type_area'), icon: AreaChartIcon },
    { value: 'pie', label: t('builder.dashboard_chart.type_pie'), icon: PieChartIcon },
    { value: 'stat', label: t('builder.dashboard_chart.type_stat'), icon: Hash },
  ]
}

// Reuses common.fn_* — table/ConfigPanel.tsx's own fnLabels draws from the
// same keys, one owner for "Count"/"Sum"/etc. across both widget types.
function fnLabels(t: I18nContextValue['t']): Record<AggregateFn, string> {
  return {
    count: t('common.fn_count'),
    sum: t('common.fn_sum'),
    avg: t('common.fn_avg'),
    min: t('common.fn_min'),
    max: t('common.fn_max'),
  }
}

// Reuses RuntimeToolbar's own bucket words (runtime.dashboard_chart.bucket.*)
// rather than a second English copy — same concept, same widget type, one
// owner. This ConfigPanel only needs the ORDERED key list for iteration.
const BUCKET_KEYS: DateBucket[] = ['day', 'week', 'month', 'quarter', 'year']

export function ChartConfigPanel({ config, onChange }: WidgetConfigPanelProps<ChartWidgetConfig>) {
  const t = useTranslation()
  const { data: form } = useForm(config.formId)
  const fields = form?.fields ?? []
  const numericFields = fields.filter((f) => NUMERIC_TYPES.includes(f.type))
  const viewerModes = useCurrentUserAttrs()

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
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.form')}</Label>
        <FormReferenceSelect value={config.formId} onChange={(formId) => patch({ formId: formId ?? '' })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.chart_type')}</Label>
        <div className="grid grid-cols-5 gap-1">
          {chartTypeOptions(t).map(({ value, label, icon: Icon }) => (
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
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.group_by')}</Label>
          <FieldSelect
            fields={fields}
            value={config.groupBy?.field ?? ''}
            onChange={(f) => patch({ groupBy: f ? { field: f } : undefined })}
          />
          {config.groupBy?.field && DATE_FIELD_TYPES.includes(fields.find((f) => f.name === config.groupBy?.field)?.type as FieldType) && (
            <>
              <BucketSelect
                value={config.groupBy.bucket}
                onChange={(bucket) => patch({ groupBy: { field: config.groupBy!.field, bucket } })}
              />
              <RangesInput
                key={config.groupBy.field}
                value={config.groupBy.ranges}
                placeholder={t('builder.dashboard_chart.ranges_placeholder_age')}
                onChange={(ranges) => patch({ groupBy: { field: config.groupBy!.field, ranges } })}
              />
            </>
          )}
          {config.groupBy?.field && NUMERIC_TYPES.includes(fields.find((f) => f.name === config.groupBy?.field)?.type as FieldType) && (
            <RangesInput
              key={config.groupBy.field}
              value={config.groupBy.ranges}
              placeholder={t('builder.dashboard_chart.ranges_placeholder_numeric')}
              onChange={(ranges) => patch({ groupBy: { field: config.groupBy!.field, ranges } })}
            />
          )}
        </div>
      )}

      {form && needsGroupBy && supportsGroupBy2 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.split_by')}</Label>
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
              {config.chartType === 'stat' ? t('builder.dashboard_chart.value_label') : t('builder.dashboard_chart.series_label')}
            </Label>
            {config.chartType !== 'stat' && (
              <button type="button" onClick={addSeries} className="flex items-center gap-1 text-[11px] text-[hsl(var(--primary))] hover:brightness-110">
                <Plus size={11} /> {t('builder.dashboard_chart.add_series')}
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
              {t('builder.dashboard_chart.no_series')}
            </p>
          )}
        </div>
      )}

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('runtime.dashboard_chart.filter.label')}</Label>
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={form.fields}
            variables={[]}
            viewerModes={viewerModes}
            onChange={(g) => patch({ filter: g })}
          />
        </div>
      )}

      {needsGroupBy && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.sort_by')}</Label>
            <SelectMenu value={config.sortBy} onValueChange={(v) => patch({ sortBy: v as ChartWidgetConfig['sortBy'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="group" className="text-xs">{t('builder.dashboard_chart.sort_group')}</SelectItem>
                <SelectItem value="value" className="text-xs">{t('builder.dashboard_chart.value_label')}</SelectItem>
              </SelectContent>
            </SelectMenu>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.direction')}</Label>
            <SelectMenu value={config.sortDir} onValueChange={(v) => patch({ sortDir: v as ChartWidgetConfig['sortDir'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc" className="text-xs">{t('common.asc')}</SelectItem>
                <SelectItem value="desc" className="text-xs">{t('common.desc')}</SelectItem>
              </SelectContent>
            </SelectMenu>
          </div>
        </div>
      )}

      {needsGroupBy && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.max_groups')}</Label>
          <Input type="number" min={1} max={200} value={config.limit} onChange={(e) => patch({ limit: Number(e.target.value) || 20 })} className="h-8 w-24 text-sm" />
        </div>
      )}

      {config.chartType !== 'pie' && (
        <Label className="flex items-center gap-2 text-[12px] font-normal text-[hsl(var(--foreground))]">
          <Checkbox checked={config.legend} onCheckedChange={(c) => patch({ legend: c === true })} />
          {t('builder.dashboard_chart.show_legend')}
        </Label>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_chart.auto_refresh')}</Label>
        <Input
          type="number"
          min={5}
          value={config.refreshSeconds ?? ''}
          onChange={(e) => patch({ refreshSeconds: e.target.value ? Number(e.target.value) : undefined })}
          placeholder={t('builder.dashboard_chart.load_once')}
          className="h-8 w-28 text-sm"
        />
      </div>

      {form && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('common.preview')}</Label>
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
  const t = useTranslation()
  return (
    <SelectMenu value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('builder.dashboard_chart.field_placeholder')} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none__" className="text-xs">{t('builder.dashboard_chart.none_option')}</SelectItem>}
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}

function BucketSelect({ value, onChange }: { value?: DateBucket; onChange: (bucket: DateBucket | undefined) => void }) {
  const t = useTranslation()
  return (
    <SelectMenu value={value ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? undefined : (v as DateBucket))}>
      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('builder.dashboard_chart.no_bucketing')} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-xs">{t('runtime.dashboard_chart.bucket.none')}</SelectItem>
        {BUCKET_KEYS.map((b) => (
          <SelectItem key={b} value={b} className="text-xs">{t('builder.dashboard_chart.bucket_by', { bucket: t(`runtime.dashboard_chart.bucket.${b}`) })}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}

// RangesInput edits a groupBy dimension's ascending numeric breakpoints as
// free text ("30, 60, 90, 120"), mirroring ERPNext's own ageing-report
// bucket editor. Keyed by the dimension's field name at the call site
// (React remounts it on a field switch, resetting local state) rather than
// derived from config on every render — an effect re-syncing from
// config.groupBy.ranges on every keystroke would strip a trailing "," or
// partial number while the user is still typing it. Commits on blur only:
// the live preview updates a beat after typing stops, not per keystroke,
// which is the trade this buffering makes.
function RangesInput({ value, onChange, placeholder }: {
  value?: number[]
  onChange: (ranges: number[] | undefined) => void
  placeholder: string
}) {
  const [text, setText] = useState(value?.join(', ') ?? '')
  const commit = () => {
    const ranges = text
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
    onChange(ranges.length > 0 ? ranges : undefined)
  }
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
      className="h-8 text-sm"
    />
  )
}

function SeriesEditor({ series, numericFields, onChange, onRemove }: {
  series: ChartSeries
  numericFields: FieldDef[]
  onChange: (patch: Partial<ChartSeries>) => void
  onRemove?: () => void
}) {
  const t = useTranslation()
  const labels = fnLabels(t)
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] p-2">
      <SelectMenu value={series.fn} onValueChange={(v) => onChange({ fn: v as AggregateFn, field: v === 'count' ? undefined : series.field })}>
        <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as AggregateFn[]).map((fn) => (
            <SelectItem key={fn} value={fn} className="text-xs">{labels[fn]}</SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
      {series.fn !== 'count' && (
        <SelectMenu value={series.field ?? ''} onValueChange={(v) => onChange({ field: v })}>
          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder={t('builder.dashboard_chart.field_placeholder')} /></SelectTrigger>
          <SelectContent>
            {numericFields.map((f) => (
              <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
            ))}
            {numericFields.length === 0 && <SelectItem value="__none__" disabled className="text-xs">{t('builder.dashboard_chart.no_numeric_fields')}</SelectItem>}
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
