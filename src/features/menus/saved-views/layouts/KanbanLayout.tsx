import { useMemo } from 'react'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { KanbanLayoutConfig } from '../types'

interface KanbanLayoutProps {
  records: FormRecord[]
  fields: FieldDef[]
  config: KanbanLayoutConfig
  onOpenRecord: (r: FormRecord) => void
  loading?: boolean
}

// Mirrors the backend's maxAggregateLimit (api/forms/handler.go:1005) — same
// "hard server-side/client-side ceiling regardless of what's requested"
// rationale, applied here to a reference-keyed Kanban's column count (§6's
// named edge case, resolved in FR-D2-014 Document Control v0.2 since v1
// ships Kanban rather than deferring it).
const MAX_KANBAN_COLUMNS = 200

interface Column {
  key: string
  label: string
}

// FR-D2-014 §3's Kanban layout element row: records grouped into columns by
// layout_config.groupField — enum (fixed EnumValues) or reference (distinct
// referenced values currently in the result set, capped per §6). v1 is
// read-only positioning (no drag-and-drop between columns, per Document
// Control v0.2 and §1's explicit out-of-scope).
export function KanbanLayout({ records, fields, config, onOpenRecord, loading }: KanbanLayoutProps) {
  const groupField = fields.find((f) => f.name === config.groupField)

  const { columns, hiddenCount } = useMemo(() => {
    if (!groupField) return { columns: [] as Column[], hiddenCount: 0 }
    if (groupField.type === 'enum') {
      return { columns: (groupField.enum_values ?? []).map((v) => ({ key: v, label: v })), hiddenCount: 0 }
    }
    // reference: distinct values actually present in the result set, capped.
    const seen = new Set<string>()
    for (const r of records) {
      const raw = r[config.groupField]
      if (raw === null || raw === undefined || raw === '') continue
      seen.add(String(raw))
    }
    const all = [...seen]
    const capped = all.slice(0, MAX_KANBAN_COLUMNS)
    return { columns: capped.map((k) => ({ key: k, label: k })), hiddenCount: Math.max(0, all.length - MAX_KANBAN_COLUMNS) }
  }, [groupField, records, config.groupField])

  const byColumn = useMemo(() => {
    const map = new Map<string, FormRecord[]>()
    for (const r of records) {
      const raw = r[config.groupField]
      const key = raw === null || raw === undefined || raw === '' ? '' : String(raw)
      const list = map.get(key)
      if (list) list.push(r)
      else map.set(key, [r])
    }
    return map
  }, [records, config.groupField])

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
  }
  if (!groupField) {
    return <div className="p-8 text-center text-sm text-slate-400">This view's Kanban field no longer exists on this form.</div>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colRecords = byColumn.get(col.key) ?? []
          return (
            <div key={col.key} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border p-2" style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--muted))' }}>
              <div className="flex items-center justify-between px-1">
                <span className="truncate text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{col.label}</span>
                <span className="text-[10px] text-slate-400">{colRecords.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {colRecords.map((r) => (
                  <button
                    key={r.id as string}
                    onClick={() => onOpenRecord(r)}
                    className="rounded-md border p-2 text-left text-xs transition-colors hover:bg-[hsl(var(--accent))]"
                    style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                  >
                    <div className="truncate font-medium" style={{ color: 'hsl(var(--foreground))' }}>{resolveRecordTitle(fields, r)}</div>
                  </button>
                ))}
                {colRecords.length === 0 && <div className="px-1 py-2 text-center text-[11px] text-slate-400">No records</div>}
              </div>
            </div>
          )
        })}
      </div>
      {hiddenCount > 0 && (
        <p className="text-[11px] text-slate-400">
          Showing the first {MAX_KANBAN_COLUMNS} distinct {groupField!.label} values as columns — {hiddenCount} more not shown as columns.
        </p>
      )}
    </div>
  )
}
