import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { CalendarLayoutConfig } from '../types'

interface CalendarLayoutProps {
  records: FormRecord[]
  fields: FieldDef[]
  config: CalendarLayoutConfig
  onOpenRecord: (r: FormRecord) => void
  loading?: boolean
}

// The month/year header a few lines below (cursor.toLocaleDateString) is
// browser-locale, not app-locale — Intl has no "follow this app's chosen
// locale" mode, so an app set to Spanish with an English browser shows
// "September" above these translated weekday abbreviations. Pre-existing
// mismatch, not introduced here; translating the weekdays is still the
// right in-scope move (they're static UI chrome the app CAN control).
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function weekdayLabel(t: I18nContextValue['t'], key: typeof WEEKDAY_KEYS[number]): string {
  return t(`menus.saved_views.calendar.weekday_${key}`)
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function toDateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`}

// FR-D2-014 §3's Calendar layout element row: records positioned by
// layout_config.dateField (a date/datetime field, gated by the column
// picker upstream — see SavedViewLayoutRenderer). §6/§3's named edge case:
// a record with a null/empty dateField value is omitted from the grid
// entirely, no "undated" affordance (v1 scope, per FR-D2-014 Document
// Control v0.2's layout-scope decision). Clicking a record opens the
// existing record-detail drawer (FR-D2-007), unchanged — handled by the
// caller via onOpenRecord.
export function CalendarLayout({ records, fields, config, onOpenRecord, loading }: CalendarLayoutProps) {
  const t = useTranslation()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const byDay = useMemo(() => {
    const map = new Map<string, FormRecord[]>()
    for (const r of records) {
      const raw = r[config.dateField]
      if (!raw) continue
      const d = new Date(raw as string)
      if (isNaN(d.getTime())) continue
      const key = toDateKey(d)
      const list = map.get(key)
      if (list) list.push(r)
      else map.set(key, [r])
    }
    return map
  }, [records, config.dateField])

  const cells = useMemo(() => {
    const first = startOfMonth(cursor)
    const gridStart = new Date(first)
    gridStart.setDate(gridStart.getDate() - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [cursor])

  const today = toDateKey(new Date())

  if (loading) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('common.loading')}</div>
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCursor(startOfMonth(new Date()))}>{t('menus.saved_views.calendar.today')}</Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border" style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--border))' }}>
        {WEEKDAY_KEYS.map((d) => (
          <div key={d} className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-wide" style={{ backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
            {weekdayLabel(t, d)}
          </div>
        ))}
        {cells.map((d, i) => {
          const key = toDateKey(d)
          const inMonth = d.getMonth() === cursor.getMonth()
          const dayRecords = byDay.get(key) ?? []
          return (
            <div
              key={i}
              className="flex min-h-[88px] flex-col gap-1 p-1.5"
              style={{ backgroundColor: 'hsl(var(--card))', opacity: inMonth ? 1 : 0.4 }}
            >
              <span
                className="self-start rounded px-1 text-[11px]"
                style={key === today ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : { color: 'hsl(var(--muted-foreground))' }}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayRecords.slice(0, 3).map((r) => (
                  <button
                    key={r.id as string}
                    onClick={() => onOpenRecord(r)}
                    className="truncate rounded px-1 py-0.5 text-left text-[11px] hover:opacity-80"
                    style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                    title={resolveRecordTitle(fields, r)}
                  >
                    {resolveRecordTitle(fields, r)}
                  </button>
                ))}
                {dayRecords.length > 3 && (
                  <span className="px-1 text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.calendar.more_count', { count: dayRecords.length - 3 })}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
