import type { NumberFormat } from '@/features/forms/types'

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** A File Upload / Image Upload field's value (FileFieldValue) rendered as
 *  plain text — for contexts too dense/historical for FileCellDisplay's
 *  thumbnail (a hook-using component, which can't be called from a plain
 *  .map() callback anyway): the audit-log diff view. Falls back to
 *  formatValue for every other shape, so a caller can use this as a drop-in
 *  formatValue replacement wherever a value MIGHT be a file field. */
export function formatFileOrValue(v: unknown): string {
  if (v && typeof v === 'object' && 'filename' in v && 'size_bytes' in v) {
    const f = v as { filename: string; size_bytes: number }
    const kb = f.size_bytes / 1024
    const size = kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`
    return `${f.filename} (${size})`
  }
  return formatValue(v)
}

// Every record's created_at/updated_at (selectCols(), internal/forms/store/
// records.go) is a raw ISO timestamp string — this renders it the same
// human-readable way RecordDetailPanel's audit log entries already do
// (toLocaleString()), rather than showing the ISO string as-is like an
// ordinary text field would.
export function formatSystemDatetime(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const d = new Date(v as string)
  if (isNaN(d.getTime())) return formatValue(v)
  return d.toLocaleString()
}

// A user-authored 'date' field arrives from the API as a full RFC3339
// timestamp, not a bare calendar date: Postgres stores a real `date` column
// (2026-08-15), but Go scans it into a time.Time and marshals it as
// "2026-08-15T00:00:00Z". Shown raw that is exactly what the end user sees,
// so every read-only surface has to format it.
//
// The calendar date is read off the string directly and rebuilt from LOCAL
// components rather than being handed to `new Date(v).toLocaleDateString()`.
// That matters: the wire value is midnight *UTC*, so parsing it as an
// instant and formatting it in any timezone west of UTC renders the PREVIOUS
// day (a Due Date of Aug 15 showing as Aug 14 in the Americas). A date field
// has no time and no timezone; treating it as an instant is what introduces
// the error.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/

export function formatDateOnly(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const m = DATE_ONLY_RE.exec(String(v))
  if (!m) return formatValue(v)
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (isNaN(d.getTime())) return formatValue(v)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// A 'time' column has no date half. Depending on how the value is marshalled
// it arrives either as a bare "14:30:00" or as an RFC3339 string carrying a
// placeholder date, so the wall-clock digits are pulled out directly and
// re-formatted from local components — again deliberately not via
// `new Date(v)`, which would shift a time that has no timezone to begin with.
const TIME_RE = /(\d{2}):(\d{2})(?::\d{2})?/

export function formatTimeOnly(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  const m = TIME_RE.exec(String(v))
  if (!m) return formatValue(v)
  const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]))
  if (isNaN(d.getTime())) return formatValue(v)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// A 'decimal'/'integer' field's stored value is a raw number with no
// thousands separator — every consumer routed through formatFieldValue
// below showed this as a bare, hard-to-scan digit string ("420000",
// "8000000"), inconsistent even with the dashboard stat-tile chart widget's
// own toLocaleString() one screen over. Grouping needs no field config, so
// that's the fallback below when `fmt` is absent — a field that never
// touched the builder's Number Format panel keeps this exact behavior.
//
// A currency symbol, percent style, or custom separators DO need field
// config — FieldDef.number_format (see its own doc comment), the same
// descriptor shape internal/reports' block/cell number_format uses on the
// Go side. When `fmt` is given, this renders it via applyNumberFormat below
// instead, which deliberately mirrors field.NumberFormat.Format's exact
// rendering order (round, group, decimals, style symbol, negative marker) —
// NOT Intl.NumberFormat({style:'currency', ...}), whose locale-driven
// grouping/rounding/symbol-placement rules would drift from what the same
// descriptor renders in a report export (PDF/DOCX/XLSX etc.), reintroducing
// exactly the cross-format divergence that type was written to prevent.
export function formatNumber(v: unknown, fmt?: NumberFormat): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return formatValue(v)
  if (!fmt) return n.toLocaleString()
  return applyNumberFormat(n, fmt)
}

// Decimals is clamped rather than trusted, mirroring field.NumberFormat's
// own decimals() helper — a format saved before validation existed, or
// written straight to storage via the API/MCP, still has to render as
// *something* rather than throw.
function clampDecimals(d: number | undefined): number {
  if (d === undefined) return 2
  if (d < 0) return 0
  if (d > 10) return 10
  return d
}

// Mirrors field.NumberFormat's roundedAbsDigits (number_format.go) exactly:
// half-away-from-zero rounding via scale-then-Math.round, not toFixed's own
// rounding — toFixed rounds half TOWARD EVEN for a value whose scaled form
// is an exact binary fraction, so (0.125).toFixed(2) gives "0.12" and
// (2.5).toFixed(0) gives "2" where the Go side (and Excel) give "0.13" and
// "3". Scaling first and calling Math.round (which always rounds .5 up)
// matches that. Neither this nor the Go implementation claims to fix the
// OTHER floating-point trap — a decimal literal like 1.005 that has no
// exact binary representation is already off by a hair before any rounding
// rule runs, in Go's float64 identically to JS's — so both render "1.00"
// there, in full agreement with each other.
function roundedAbsDigits(v: number, decimals: number): string {
  let abs = Math.abs(v)
  if (!Number.isFinite(abs)) return String(abs)
  const scale = Math.pow(10, decimals)
  if (decimals > 0 && abs * scale < Number.MAX_SAFE_INTEGER) {
    abs = Math.round(abs * scale) / scale
  } else if (decimals === 0) {
    abs = Math.round(abs)
  }
  return abs.toFixed(decimals)
}

// Mirrors field.NumberFormat's groupDigits: inserts sep every three digits
// from the right.
function groupDigits(digits: string, sep: string): string {
  if (!sep || digits.length <= 3) return digits
  let lead = digits.length % 3
  if (lead === 0) lead = 3
  let out = digits.slice(0, lead)
  for (let i = lead; i < digits.length; i += 3) {
    out += sep + digits.slice(i, i + 3)
  }
  return out
}

// Renders `v` per `fmt`, in the exact order field.NumberFormat.Format
// (number_format.go) does, so a record's on-screen value and the same
// descriptor's report-exported cell never disagree: percent multiplies by
// 100 first, then the magnitude is rounded and grouped, then the style's
// symbol/suffix is applied, then the sign (or accounting parentheses).
function applyNumberFormat(input: number, fmt: NumberFormat): string {
  const v = fmt.style === 'percent' ? input * 100 : input

  const digits = roundedAbsDigits(v, clampDecimals(fmt.decimals))
  // math.Signbit's equivalent — catches -0 too, so a value that rounds to
  // zero from just below still renders "-0.00", matching the Go renderer
  // (and, in turn, the same descriptor's PDF/DOCX export) rather than
  // silently dropping the sign.
  const negative = v < 0 || (v === 0 && 1 / v === -Infinity)

  const dot = digits.indexOf('.')
  const intPart = dot >= 0 ? digits.slice(0, dot) : digits
  const fracPart = dot >= 0 ? digits.slice(dot + 1) : ''

  const thousandsSep = fmt.thousands_separator ?? ','
  const decimalSep = fmt.decimal_separator || '.'

  let out = groupDigits(intPart, thousandsSep)
  if (fracPart) out += decimalSep + fracPart

  if (fmt.style === 'percent') {
    out += '%'
  } else if (fmt.style === 'currency') {
    const symbol = fmt.currency_symbol ?? ''
    out = fmt.currency_position === 'suffix' ? out + symbol : symbol + out
  }

  if (!negative) return out
  return fmt.negative_style === 'parentheses' ? `(${out})` : `-${out}`
}

/** Field-type-aware display formatting for a read-only value.
 *
 *  Every temporal field type ('date'/'time'/'datetime') comes over the wire
 *  as an RFC3339 string and is unreadable shown raw; every other type falls
 *  through to formatValue unchanged. That makes this a drop-in replacement
 *  anywhere a call site currently ends in a bare `formatValue(record[key])`
 *  fallback — which is precisely where this bug kept hiding: RecordsTable,
 *  FieldValueDisplay (Detail Page), CardLayout and KanbanLayout each carry
 *  the same reference/role/enum/file branch chain and each ended in that
 *  same untyped fallback, so a date rendered raw in all four. Route new
 *  read-only surfaces through here rather than adding a fifth copy.
 *
 *  `type` is FieldType ('decimal'/'integer'/'date'/...) at three of those
 *  four call sites, but FieldValueDisplay passes `el.component` instead —
 *  which happens to share FieldType's own spelling for 'date'/'time'/
 *  'datetime', but NOT for numbers: the Number component's fieldType is
 *  'decimal' (component-registry.ts), so 'number' is handled here too.
 *
 *  `numberFormat` is optional and only consulted for the numeric branch —
 *  every call site already holds either the field's own FieldDef (whose
 *  `number_format` passes straight through) or, at FieldValueDisplay, the
 *  builder FormElement (`numberFormat`, the identical descriptor shape).
 *  Omitting it keeps today's plain-grouped-number rendering. */
export function formatFieldValue(v: unknown, type?: string, numberFormat?: NumberFormat): string {
  switch (type) {
    case 'date': return formatDateOnly(v)
    case 'datetime': return formatSystemDatetime(v)
    case 'time': return formatTimeOnly(v)
    case 'integer':
    case 'decimal':
    case 'number': return formatNumber(v, numberFormat)
    default: return formatValue(v)
  }
}
