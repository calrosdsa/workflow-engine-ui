import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { parseTimeInputValue, toTimeInputValue, formatTimeDisplay } from '@/lib/datetime'

// 'sm' matches the compact filter-row controls (FilterBuilder's SelectField
// 'value' size); 'default' matches a normal full-width form field (Input's
// own h-9), used by FieldRenderer's own time/date/datetime fields and
// LineItemsGrid's grid-cell editors. Shared with date-time-picker.tsx.
export type PickerSize = 'sm' | 'default'

export function triggerSizeClass(size: PickerSize) {
  return size === 'sm' ? 'h-7 text-[12px] px-2' : 'h-9 text-sm px-3'
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
export const MINUTES = Array.from({ length: 60 }, (_, i) => i)

export function to12Hour(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return { hour12, period }
}

export function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 % 12
  return (hour12 % 12) + 12
}

interface TimeColumnProps<T> {
  items: T[]
  selected: T
  onSelect: (item: T) => void
  format: (item: T) => string
  size?: 'sm' | 'md'
}

// Shared by TimePicker's own hour/minute columns and DateTimePicker's
// embedded time row (date-time-picker.tsx) — kept exported rather than
// duplicated, since the two pickers' time UI is meant to feel identical.
export function TimeColumn<T extends number | string>({ items, selected, onSelect, format, size = 'md' }: TimeColumnProps<T>) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div
      className={cn('overflow-y-auto scroll-py-1 py-1', size === 'sm' ? 'h-44 w-10' : 'h-48 w-14')}
      style={{ scrollbarWidth: 'thin' }}
    >
      {items.map((item) => {
        const isSelected = item === selected
        return (
          <button
            key={item}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              'flex w-full items-center justify-center rounded-md py-1.5 tabular-nums transition-colors',
              size === 'sm' ? 'text-[12px]' : 'text-[13px]',
              isSelected
                ? 'bg-[hsl(var(--primary))] font-medium text-[hsl(var(--primary-foreground))]'
                : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]',
            )}
          >
            {format(item)}
          </button>
        )
      })}
    </div>
  )
}

interface PeriodToggleProps {
  period: 'AM' | 'PM'
  onSelect: (p: 'AM' | 'PM') => void
  size?: 'sm' | 'md'
}

export function PeriodToggle({ period, onSelect, size = 'md' }: PeriodToggleProps) {
  return (
    <div className={cn('flex flex-col justify-center gap-1', size === 'sm' ? 'h-44 w-10' : 'h-48 w-12')}>
      {(['AM', 'PM'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={cn(
            'rounded-md py-1.5 font-medium transition-colors',
            size === 'sm' ? 'text-[11px]' : 'text-[12px]',
            period === p
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

interface TimePickerProps {
  /** 'HH:mm' (24-hour), matching a native <input type="time"> value. */
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  size?: PickerSize
  disabled?: boolean
  /** Applied to the popover trigger, so a `<label htmlFor>` can point at this
   *  control — same reasoning as DatePickerProps.id. */
  id?: string
}

// A Popover-based time picker with scrollable hour/minute/AM-PM columns —
// replaces the bare native <input type="time"> used across the runtime
// (FilterBuilder's date-value row, FieldRenderer's own 'time' field,
// LineItemsGrid's grid-cell 'time' column) with a picker that matches the
// same "click to open, pick, done" shape as DatePicker/DateTimePicker in
// this same file's sibling date-time-picker.tsx, rather than falling back
// to OS chrome that looks out of place next to them.
export function TimePicker({ value, onChange, className, placeholder = 'select time…', size = 'default', disabled, id }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = parseTimeInputValue(value)
  const { hour12, period } = parsed ? to12Hour(parsed.hour) : { hour12: 12, period: 'AM' as const }
  const minute = parsed?.minute ?? 0

  const commit = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    onChange(toTimeInputValue(to24Hour(nextHour12, nextPeriod), nextMinute))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-1.5 font-normal',
            triggerSizeClass(size),
            !parsed && 'text-[hsl(var(--muted-foreground))]',
            className,
          )}
        >
          <Clock size={size === 'sm' ? 12 : 14} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="truncate">{parsed ? formatTimeDisplay(parsed.hour, parsed.minute) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2"
        container={document.getElementById('runtime-root') ?? document.body}
      >
        <div className="flex gap-1">
          <TimeColumn items={HOURS_12} selected={hour12} onSelect={(h) => commit(h, minute, period)} format={(h) => String(h)} />
          <TimeColumn items={MINUTES} selected={minute} onSelect={(m) => commit(hour12, m, period)} format={(m) => String(m).padStart(2, '0')} />
          <PeriodToggle period={period} onSelect={(p) => commit(hour12, minute, p)} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
