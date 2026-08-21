// Shared parsing/formatting for the date/time input value shape used
// throughout the runtime app: plain 'YYYY-MM-DD' (date), 'HH:mm' (time), and
// 'YYYY-MM-DDTHH:mm' (datetime) strings — the same shape a native
// <input type="date"|"time"|"datetime-local"> already produces, kept as-is
// so the value round-trips through record storage/filter conditions
// unchanged; only the editing UI (DatePicker/TimePicker/DateTimePicker)
// changed, not the wire format.

// `new Date('2026-08-15')` parses as UTC midnight, which renders as the
// previous day in negative UTC-offset timezones — the date portion is
// parsed manually instead so it always lands on the intended local day.
export function parseDateInputValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return undefined
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseTimeInputValue(value: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return undefined
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

export function toTimeInputValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

// e.g. "Aug 15, 2026" — used as the DatePicker/DateTimePicker trigger label
// once a value is set, replacing the raw ISO string a native input shows.
export function formatDateDisplay(value: string): string | undefined {
  const d = parseDateInputValue(value)
  if (!d) return undefined
  return dateFormatter.format(d)
}

// e.g. "2:30 PM" — used standalone by TimePicker and appended to
// formatDateDisplay's output by DateTimePicker.
export function formatTimeDisplay(hour: number, minute: number): string {
  const d = new Date(2000, 0, 1, hour, minute)
  return timeFormatter.format(d)
}

// e.g. "Aug 15, 2026, 2:30 PM"
export function formatDateTimeDisplay(value: string): string | undefined {
  const datePart = formatDateDisplay(value)
  if (!datePart) return undefined
  const time = parseTimeInputValue(value.slice(11))
  if (!time) return datePart
  return `${datePart}, ${formatTimeDisplay(time.hour, time.minute)}`
}
