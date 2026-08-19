export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
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
