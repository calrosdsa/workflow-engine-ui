import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { TimeColumn, PeriodToggle, HOURS_12, MINUTES, to12Hour, to24Hour, triggerSizeClass, type PickerSize } from '@/components/ui/time-picker'
import { cn } from '@/lib/utils'
import {
  parseDateInputValue,
  toDateInputValue,
  parseTimeInputValue,
  toTimeInputValue,
  formatDateDisplay,
  formatDateTimeDisplay,
} from '@/lib/datetime'

interface DatePickerProps {
  /** 'YYYY-MM-DD', matching a native <input type="date"> value. */
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  size?: PickerSize
  disabled?: boolean
}

// A calendar-in-a-Popover date picker. Picking a day both commits and
// closes the popover — there's nothing else to configure for a date-only
// value, unlike DateTimePicker below which keeps the popover open for a
// time to be picked too.
export function DatePicker({ value, onChange, className, placeholder = 'select date…', size = 'default', disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = parseDateInputValue(value)
  const display = formatDateDisplay(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-1.5 font-normal',
            triggerSizeClass(size),
            !display && 'text-[hsl(var(--muted-foreground))]',
            className,
          )}
        >
          <CalendarDays size={size === 'sm' ? 12 : 14} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="truncate">{display ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        container={document.getElementById('runtime-root') ?? document.body}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          autoFocus
          onSelect={(d) => {
            if (!d) return
            onChange(toDateInputValue(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateTimePickerProps {
  /** 'YYYY-MM-DDTHH:mm', matching a native <input type="datetime-local"> value. */
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  size?: PickerSize
  disabled?: boolean
}

// A single Popover holding both the calendar and a compact hour/minute/
// AM-PM time row, so picking a full instant is one open→pick→Done flow
// instead of two separate controls (a calendar popover plus a bare time
// input beside it, this component's own earlier shape). The trigger shows
// the finished value in a human date+time format ("Aug 15, 2026, 2:30 PM")
// rather than the raw 'YYYY-MM-DDTHH:mm' string. Edits are buffered locally
// and only committed via the Done button, mirroring the outer filter
// popover's own draft-then-Apply pattern in RecordsTable.tsx — so clicking
// a day doesn't fire an onChange per click before a time has even been
// chosen.
export function DateTimePicker({ value, onChange, className, placeholder = 'select date & time…', size = 'default', disabled }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value || '')
  }, [open, value])

  const draftDate = parseDateInputValue(draft)
  const draftTime = parseTimeInputValue(draft.slice(11)) ?? { hour: 9, minute: 0 }
  const { hour12, period } = to12Hour(draftTime.hour)
  const display = formatDateTimeDisplay(value)

  const setDraftDate = (d: Date) => {
    const nextDatePart = toDateInputValue(d)
    const timePart = toTimeInputValue(draftTime.hour, draftTime.minute)
    setDraft(`${nextDatePart}T${timePart}`)
  }
  const setDraftTime = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    const datePart = draftDate ? toDateInputValue(draftDate) : toDateInputValue(new Date())
    setDraft(`${datePart}T${toTimeInputValue(to24Hour(nextHour12, nextPeriod), nextMinute)}`)
  }

  const commit = () => {
    onChange(draft)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-1.5 font-normal',
            triggerSizeClass(size),
            !display && 'text-[hsl(var(--muted-foreground))]',
            className,
          )}
        >
          <CalendarDays size={size === 'sm' ? 12 : 14} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="truncate">{display ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        container={document.getElementById('runtime-root') ?? document.body}
      >
        <div className="flex">
          <Calendar
            mode="single"
            selected={draftDate}
            defaultMonth={draftDate}
            onSelect={(d) => d && setDraftDate(d)}
          />
          <div
            className="flex flex-col border-l"
            style={{ borderColor: 'hsl(var(--border))' }}
          >
            <div className="flex flex-1 gap-1 p-2">
              <TimeColumn items={HOURS_12} selected={hour12} onSelect={(h) => setDraftTime(h, draftTime.minute, period)} format={(h) => String(h)} size="sm" />
              <TimeColumn items={MINUTES} selected={draftTime.minute} onSelect={(m) => setDraftTime(hour12, m, period)} format={(m) => String(m).padStart(2, '0')} size="sm" />
              <PeriodToggle period={period} onSelect={(p) => setDraftTime(hour12, draftTime.minute, p)} size="sm" />
            </div>
            <div className="border-t p-2" style={{ borderColor: 'hsl(var(--border))' }}>
              <Button type="button" size="sm" className="w-full" disabled={!draftDate} onClick={commit}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
