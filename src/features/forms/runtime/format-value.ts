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
