import { useEffect, useState, type ReactNode } from 'react'
import { CalendarRange, Clock, Filter as FilterIcon } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { SelectMenu, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { DatePicker } from '@/components/ui/date-time-picker'
import { ActiveFiltersBar } from '@/components/ui/active-filters-bar'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { RANGE_PRESETS, getPresetRange } from './date-range'
import type { RangePreset, DateRange } from './date-range'
import type { FieldDef } from '@/features/forms/types'
import type { DateBucket } from '@/features/forms/api'
import type { FilterGroup } from '@/features/workflows/types'

const BUCKET_ORDER: DateBucket[] = ['day', 'week', 'month', 'quarter', 'year']

// Small, icon-only, ghost-hover trigger — the same h-7 compact convention
// RecordDetailToolbar.tsx's "..." trigger already uses, so this survives a
// narrow (minW: 3 grid units) dashboard tile without wrapping/overflowing.
const ICON_TRIGGER = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'

function formatSyncedAgo(dataUpdatedAt: number | undefined, t: ReturnType<typeof useTranslation>): string | undefined {
  if (!dataUpdatedAt) return undefined
  const diffMs = Date.now() - dataUpdatedAt
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return t('runtime.dashboard_chart.synced_just_now')
  if (mins < 60) return t('runtime.dashboard_chart.synced_minutes_ago', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('runtime.dashboard_chart.synced_hours_ago', { n: hours })
  return t('runtime.dashboard_chart.synced_days_ago', { n: Math.floor(hours / 24) })
}

interface RuntimeToolbarProps {
  fields: FieldDef[]
  showTimeControls: boolean
  bucket: DateBucket | undefined
  onBucketChange: (bucket: DateBucket | undefined) => void
  range: DateRange | undefined
  onRangeChange: (range: DateRange | undefined) => void
  adhocFilter: FilterGroup | undefined
  onAdhocFilterChange: (filter: FilterGroup | undefined) => void
  dataUpdatedAt: number | undefined
  /** Rendered as the last item in the icon-button row — the widget's
   *  ChartMenu ("..." Refresh/Reset/Export/View records). Kept as a slot
   *  rather than an import so this component doesn't need to know
   *  ChartMenu's own (much larger) prop set. */
  menuSlot?: ReactNode
}

/** The viewer-facing control strip rendered above a chart widget's plot
 *  area at runtime only (see Renderer.tsx's mode==='runtime' gate) — time
 *  range + bucket (only when the chart's groupBy is a date field), an
 *  ad-hoc filter additive to the widget's saved filter, and a last-synced
 *  indicator. The "..." menu (Refresh/Reset/Export/View records) is the
 *  sibling ChartMenu component, kept separate since it's navigation/action
 *  concerns rather than data-shaping controls. */
export function RuntimeToolbar({
  fields, showTimeControls, bucket, onBucketChange, range, onRangeChange, adhocFilter, onAdhocFilterChange, dataUpdatedAt, menuSlot,
}: RuntimeToolbarProps) {
  const t = useTranslation()
  // formatSyncedAgo reads Date.now() at render time, so without a periodic
  // re-render this text would freeze at whatever it said on mount (e.g.
  // "just now" forever). A 30s tick is frequent enough that the coarsest
  // displayed unit (minutes) never visibly lags.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const synced = formatSyncedAgo(dataUpdatedAt, t)
  const hasAdhocConditions = (adhocFilter?.conditions.length ?? 0) > 0

  return (
    <div className="flex shrink-0 flex-col border-b px-2 py-1" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{synced}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          {showTimeControls && <TimeRangeControl range={range} onRangeChange={onRangeChange} t={t} />}
          {showTimeControls && <BucketControl bucket={bucket} onBucketChange={onBucketChange} t={t} />}
          <AdhocFilterControl fields={fields} filter={adhocFilter} onFilterChange={onAdhocFilterChange} t={t} />
          {menuSlot}
        </div>
      </div>
      {hasAdhocConditions && adhocFilter && (
        <ActiveFiltersBar
          filter={adhocFilter}
          fields={fields}
          onRemoveCondition={(idx) => onAdhocFilterChange({ ...adhocFilter, conditions: adhocFilter.conditions.filter((_, i) => i !== idx) })}
          onResetAll={() => onAdhocFilterChange(undefined)}
        />
      )}
    </div>
  )
}

function TimeRangeControl({ range, onRangeChange, t }: {
  range: DateRange | undefined
  onRangeChange: (range: DateRange | undefined) => void
  t: ReturnType<typeof useTranslation>
}) {
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const openChange = (o: boolean) => {
    if (o) { setCustomFrom(range?.from ?? ''); setCustomTo(range?.to ?? '') }
    setOpen(o)
  }
  const applyPreset = (preset: Exclude<RangePreset, 'custom'>) => {
    onRangeChange(getPresetRange(preset))
    setOpen(false)
  }
  const applyCustom = () => {
    if (!customFrom || !customTo) return
    onRangeChange({ from: customFrom, to: customTo })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button type="button" title={t('runtime.dashboard_chart.range.label')} className={ICON_TRIGGER + (range ? ' text-[hsl(var(--primary))]' : '')}>
          <CalendarRange size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2" container={document.getElementById('runtime-root')}>
        <div className="space-y-0.5">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
            >
              {t(`runtime.dashboard_chart.range.${preset}`)}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-1.5 border-t pt-2" style={{ borderColor: 'hsl(var(--border))' }}>
          <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('runtime.dashboard_chart.range.custom')}</span>
          <div className="flex items-center gap-1">
            <DatePicker value={customFrom} onChange={setCustomFrom} />
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('runtime.dashboard_chart.range.to')}</span>
            <DatePicker value={customTo} onChange={setCustomTo} />
          </div>
          <Button size="sm" className="w-full" disabled={!customFrom || !customTo} onClick={applyCustom}>
            {t('runtime.dashboard_chart.apply')}
          </Button>
        </div>
        {range && (
          <button
            type="button"
            onClick={() => { onRangeChange(undefined); setOpen(false) }}
            className="mt-2 w-full rounded-md py-1 text-center text-[11px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
          >
            {t('runtime.dashboard_chart.range.clear')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function BucketControl({ bucket, onBucketChange, t }: {
  bucket: DateBucket | undefined
  onBucketChange: (bucket: DateBucket | undefined) => void
  t: ReturnType<typeof useTranslation>
}) {
  return (
    <SelectMenu value={bucket ?? '__none__'} onValueChange={(v) => onBucketChange(v === '__none__' ? undefined : (v as DateBucket))}>
      <SelectTrigger
        title={t('runtime.dashboard_chart.bucket.label', { value: bucket ? t(`runtime.dashboard_chart.bucket.${bucket}`) : t('runtime.dashboard_chart.bucket.none') })}
        className={'h-7 w-auto gap-0.5 border-0 bg-transparent px-1.5 shadow-none text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]' + (bucket ? ' text-[hsl(var(--primary))]' : '')}
      >
        <Clock size={14} />
      </SelectTrigger>
      <SelectContent container={document.getElementById('runtime-root')}>
        <SelectItem value="__none__" className="text-xs">{t('runtime.dashboard_chart.bucket.none')}</SelectItem>
        {BUCKET_ORDER.map((b) => (
          <SelectItem key={b} value={b} className="text-xs">{t(`runtime.dashboard_chart.bucket.${b}`)}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}

function AdhocFilterControl({ fields, filter, onFilterChange, t }: {
  fields: FieldDef[]
  filter: FilterGroup | undefined
  onFilterChange: (filter: FilterGroup | undefined) => void
  t: ReturnType<typeof useTranslation>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterGroup>(filter ?? newGroup())
  const conditionCount = filter?.conditions.length ?? 0

  const openChange = (o: boolean) => {
    if (o) setDraft(filter ?? newGroup())
    setOpen(o)
  }
  const apply = () => {
    onFilterChange(draft.conditions.length === 0 && draft.groups.length === 0 ? undefined : draft)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button type="button" title={t('runtime.dashboard_chart.filter.label')} className={'relative ' + ICON_TRIGGER + (conditionCount > 0 ? ' text-[hsl(var(--primary))]' : '')}>
          <FilterIcon size={14} />
          {conditionCount > 0 && (
            <Badge variant="default" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
              {conditionCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[28rem] max-w-[calc(100vw-2rem)] p-0" container={document.getElementById('runtime-root')}>
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto p-3">
          <FilterBuilder group={draft} fields={fields} variables={[]} onChange={setDraft} hideExpressions />
        </div>
        <div className="flex items-center justify-end gap-1.5 border-t p-2" style={{ borderColor: 'hsl(var(--border))' }}>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t('runtime.dashboard_chart.cancel')}</Button>
          <Button size="sm" onClick={apply}>{t('runtime.dashboard_chart.apply')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
