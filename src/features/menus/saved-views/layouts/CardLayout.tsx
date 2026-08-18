import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import { formatValue } from '@/features/forms/runtime/format-value'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { CardLayoutConfig } from '../types'

interface CardLayoutProps {
  records: FormRecord[]
  fields: FieldDef[]
  config: CardLayoutConfig
  onOpenRecord: (r: FormRecord) => void
  loading?: boolean
}

// FR-D2-014 §3's Card layout element row: a responsive grid of cards.
// titleField/subtitleField/bodyFields pick which columns appear where;
// title falls back to resolveRecordTitle (FR-C1-005) when unset, exactly
// as specified.
export function CardLayout({ records, fields, config, onOpenRecord, loading }: CardLayoutProps) {
  const titleField = config.titleField ? fields.find((f) => f.name === config.titleField) : undefined
  const subtitleField = config.subtitleField ? fields.find((f) => f.name === config.subtitleField) : undefined
  const bodyFields = (config.bodyFields ?? [])
    .map((name) => fields.find((f) => f.name === name))
    .filter((f): f is FieldDef => !!f)

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
  }
  if (records.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-400">No records match this view.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {records.map((r) => {
        const title = titleField ? formatValue(r[titleField.name]) : resolveRecordTitle(fields, r)
        return (
          <button
            key={r.id as string}
            onClick={() => onOpenRecord(r)}
            className="flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-[hsl(var(--accent))]"
            style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{title}</span>
              {subtitleField && (
                <span className="truncate text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {formatValue(r[subtitleField.name])}
                </span>
              )}
            </div>
            {bodyFields.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'hsl(var(--border))' }}>
                {bodyFields.map((f) => (
                  <div key={f.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="shrink-0 text-slate-400">{f.label}</span>
                    <span className="truncate text-right" style={{ color: 'hsl(var(--foreground))' }}>{formatValue(r[f.name])}</span>
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
