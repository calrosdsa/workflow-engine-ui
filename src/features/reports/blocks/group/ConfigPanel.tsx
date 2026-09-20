import { Plus, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForms, useForm } from '@/features/forms/hooks'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import { useReportStore } from '../../store'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import { ColumnNumberFormat } from '../ColumnNumberFormat'
import type { GroupBlockConfig, AggFn, GroupSeries, GroupByDimension } from './schema'

const AGG_FNS: AggFn[] = ['count', 'sum', 'avg', 'min', 'max', 'count_distinct']
const BUCKETS = ['', 'day', 'week', 'month', 'quarter', 'year'] as const

function aggLabels(t: I18nContextValue['t']): Record<AggFn, string> {
  return {
    count: t('reports.blocks.group.agg_count'),
    sum: t('reports.blocks.group.agg_sum'),
    avg: t('reports.blocks.group.agg_avg'),
    min: t('reports.blocks.group.agg_min'),
    max: t('reports.blocks.group.agg_max'),
    count_distinct: t('reports.blocks.group.agg_count_distinct'),
  }
}

function bucketLabel(t: I18nContextValue['t'], bucket: string): string {
  switch (bucket) {
    case 'day': return t('reports.blocks.group.bucket_day')
    case 'week': return t('reports.blocks.group.bucket_week')
    case 'month': return t('reports.blocks.group.bucket_month')
    case 'quarter': return t('reports.blocks.group.bucket_quarter')
    case 'year': return t('reports.blocks.group.bucket_year')
    default: return t('reports.blocks.group.no_bucketing')
  }
}

// Config surface for the "group"/subtotal block type (FR-J1-002 §1): a data
// source (or, for a region predating FR-J1-005, a bare form) picker, an
// optional group-by field/bucket, and a list of measure series — the
// report-authoring wrapper around RecordStore.Aggregate's own group-by/
// measure shape (FR-B1-006), reused unmodified server-side.
export function GroupBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<GroupBlockConfig>) {
  const t = useTranslation()
  const aggLabelMap = aggLabels(t)
  const { data: forms } = useForms()
  const sources = useReportStore((state) => state.definition.data_sources) ?? []
  // Mirrors the table block's own source-then-form fallback exactly
  // (TableBlockConfigPanel's own comment): source_id, when set, wins over
  // form_id server-side (block_group.go), so the picker order here must
  // match that or an author could set both and watch the form choice do
  // nothing.
  const source = sources.find((s) => s.id === config.source_id)
  const effectiveFormID = source?.form_id ?? config.form_id
  const { data: form } = useForm(effectiveFormID)

  const updateSeries = (index: number, patch: Partial<GroupSeries>) => {
    const next = config.series.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange({ ...config, series: next })
  }
  const addSeries = () => onChange({ ...config, series: [...config.series, { fn: 'count' }] })
  const removeSeries = (index: number) => onChange({ ...config, series: config.series.filter((_, i) => i !== index) })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.blocks.data_source_label')}</Label>
        <SelectMenu
          value={config.source_id ?? ''}
          onValueChange={(source_id) => onChange({ ...config, source_id, form_id: '', group_by: undefined })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('reports.blocks.choose_data_source_placeholder')} /></SelectTrigger>
          <SelectContent>
            {sources.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                {t('reports.blocks.no_data_sources')}
              </div>
            ) : (
              sources.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </SelectMenu>
        {source && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t('reports.blocks.source_hint')}
          </p>
        )}
      </div>

      {!config.source_id && config.form_id && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {t('reports.data_sources.form_label')} <span className="font-normal">({t('reports.blocks.predates_data_sources')})</span>
          </Label>
          <SelectMenu
            value={config.form_id}
            onValueChange={(form_id) => onChange({ ...config, form_id, group_by: undefined })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('reports.choose_form_placeholder')} /></SelectTrigger>
            <SelectContent>
              {(forms ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>
        </div>
      )}


      {form && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {t('reports.blocks.group.group_by_label')} <span className="font-normal">({t('reports.blocks.group.group_by_hint')})</span>
          </Label>
          <SelectMenu
            value={config.group_by?.field ?? ''}
            onValueChange={(field) => onChange({ ...config, group_by: field ? { field } : undefined })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('reports.blocks.group.no_grouping')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">{t('reports.blocks.group.no_grouping')}</SelectItem>
              {form.fields.map((f) => (
                <SelectItem key={f.name} value={f.name} className="text-xs">{f.label}</SelectItem>
              ))}
            </SelectContent>
          </SelectMenu>

          {config.group_by && (form.fields.find((f) => f.name === config.group_by!.field)?.type === 'date' || form.fields.find((f) => f.name === config.group_by!.field)?.type === 'datetime') && (
            <SelectMenu
              value={config.group_by.bucket ?? ''}
              onValueChange={(bucket) => onChange({ ...config, group_by: { ...config.group_by!, bucket: bucket as GroupByDimension['bucket'] } })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('reports.blocks.group.no_bucketing')} /></SelectTrigger>
              <SelectContent>
                {BUCKETS.map((b) => (
                  <SelectItem key={b} value={b} className="text-xs">{bucketLabel(t, b)}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.blocks.group.measures_label')}</Label>
        <div className="flex flex-col gap-2">
          {config.series.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--border))] p-1.5">
              <SelectMenu value={s.fn} onValueChange={(fn) => updateSeries(i, { fn: fn as AggFn })}>
                <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGG_FNS.map((fn) => <SelectItem key={fn} value={fn} className="text-xs">{aggLabelMap[fn]}</SelectItem>)}
                </SelectContent>
              </SelectMenu>
              {s.fn !== 'count' && form && (
                <SelectMenu value={s.field ?? ''} onValueChange={(field) => updateSeries(i, { field })}>
                  <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder={t('reports.field_placeholder')} /></SelectTrigger>
                  <SelectContent>
                    {form.fields.map((f) => <SelectItem key={f.name} value={f.name} className="text-xs">{f.label}</SelectItem>)}
                  </SelectContent>
                </SelectMenu>
              )}
              <Input
                value={s.label ?? ''}
                onChange={(e) => updateSeries(i, { label: e.target.value })}
                placeholder={t('reports.blocks.group.measure_label_placeholder')}
                className="h-7 flex-1 text-xs"
              />
              {config.series.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeSeries(i)}>
                  <X size={12} />
                </Button>
              )}
              {/* A count is a tally of rows, so a currency or percent format
                  on it would be meaningless — offered only for the measures
                  that produce a real quantity. */}
              {s.fn !== 'count' && (
                <ColumnNumberFormat
                  value={s.number_format}
                  onChange={(number_format) => updateSeries(i, { number_format })}
                />
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-1 h-7 gap-1.5 self-start text-xs" onClick={addSeries}>
          <Plus size={12} /> {t('reports.blocks.group.add_measure')}
        </Button>
      </div>
    </div>
  )
}
