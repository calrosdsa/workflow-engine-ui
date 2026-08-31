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
 *  read-only surfaces through here rather than adding a fifth copy. */
export function formatFieldValue(v: unknown, type?: string): string {
  switch (type) {
    case 'date': return formatDateOnly(v)
    case 'datetime': return formatSystemDatetime(v)
    case 'time': return formatTimeOnly(v)
    default: return formatValue(v)
  }
}
