import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import { formatValue, formatSystemDatetime } from '@/features/forms/runtime/format-value'
import { RoleValueLabel } from '@/features/forms/runtime/RoleValueLabel'
import type { FieldDef, FormRecord } from '@/features/forms/types'

interface CardLayoutProps {
  records: FormRecord[]
  fields: FieldDef[]
  /** The view's own visible-columns list (ColumnsPicker/RecordsTable's
   *  visibleColumns) — every one of these renders as a body row on the
   *  card, in the same order the List layout's columns appear in. The
   *  title is always the record's own resolved title (FR-C1-005), never
   *  one of the body columns, so nothing needs to be picked twice. */
  columns: string[]
  /** form.create_user_role_field — the Account section's Role field key, if
   *  this form has one, so its stored role ID resolves to a real role name
   *  instead of showing the raw UUID (mirrors RecordsTable's List-column
   *  handling — see RoleValueLabel's own doc comment). */
  roleField?: string
  onOpenRecord: (r: FormRecord) => void
  loading?: boolean
}

// FR-D2-014 §3's Card layout element row: a responsive grid of cards.
// Title is always resolveRecordTitle's resolved title (FR-C1-005) — no
// per-view title-field override (removed per direct feedback: "remove
// title and subtitle section"). Every column the view's own Columns picker
// marks visible renders as a labeled body row, so Card shows the same data
// List does, just presented as cards instead of table rows.
export function CardLayout({ records, fields, columns, roleField, onOpenRecord, loading }: CardLayoutProps) {
  const bodyFields = columns
    .map((name) => fields.find((f) => f.name === name))
    .filter((f): f is FieldDef => !!f)

  if (loading) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</div>
  }
  if (records.length === 0) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No records match this view.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {records.map((r) => {
        const title = resolveRecordTitle(fields, r)
        return (
          <button
            key={r.id as string}
            onClick={() => onOpenRecord(r)}
            className="flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]"
            style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
          >
            <span className="truncate text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{title}</span>
            {bodyFields.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'hsl(var(--border))' }}>
                {bodyFields.map((f) => (
                  <div key={f.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>{f.label}</span>
                    <span className="truncate text-right" style={{ color: 'hsl(var(--foreground))' }}>
                      {f.name === 'created_at' || f.name === 'updated_at'
                        ? formatSystemDatetime(r[f.name])
                        : f.name === roleField
                        ? <RoleValueLabel roleId={r[f.name]} />
                        : formatValue(r[f.name])}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
