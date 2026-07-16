import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  /** Custom cell renderer — falls back to formatCell(row[key]) when omitted.
   *  Lets columns render badges/action buttons instead of plain text. */
  render?: (row: Record<string, unknown>) => React.ReactNode
  /** Right-aligns the header + cells — used for an Actions column. */
  align?: 'left' | 'right'
}

export interface DataTableProps {
  columns: DataTableColumn[]
  rows: Record<string, unknown>[]
  getRowId: (row: Record<string, unknown>) => string
  sortField?: string
  sortDir?: 'asc' | 'desc'
  onSortChange?: (field: string) => void
  onRowClick?: (row: Record<string, unknown>) => void
  emptyMessage?: string
  /** Renders skeleton placeholder rows instead of `rows` — lets every
   *  consumer (search lists, audit/linked-record tabs) share one loading
   *  treatment instead of each hand-rolling a "Loading…" string. */
  loading?: boolean
}

// A plain native <table>, not a Radix primitive — there's no accessible-
// primitives gap to fill for tabular data (same reasoning select.tsx's
// native <select> variant already demonstrates elsewhere in this codebase).
export function DataTable({ columns, rows, getRowId, sortField, sortDir, onSortChange, onRowClick, emptyMessage, loading }: DataTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b" style={{ borderColor: 'hsl(var(--border))' }}>
          {columns.map((col) => (
            <th
              key={col.key}
              className={cn('px-3 py-2 font-medium', col.align === 'right' ? 'text-right' : 'text-left')}
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              {col.sortable ? (
                <button
                  onClick={() => onSortChange?.(col.key)}
                  className="flex items-center gap-1 hover:opacity-80"
                >
                  {col.label}
                  {sortField === col.key ? (
                    sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="opacity-30" />
                  )}
                </button>
              ) : (
                col.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b" style={{ borderColor: 'hsl(var(--border))' }}>
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  <div className="h-4 w-full max-w-32 animate-pulse rounded bg-slate-100" />
                </td>
              ))}
            </tr>
          ))
        ) : (
          <>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {emptyMessage ?? 'No records found.'}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={() => onRowClick?.(row)}
                className={cn('border-b transition-colors', onRowClick && 'cursor-pointer hover:bg-black/5')}
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2', col.align === 'right' && 'text-right')}>
                    {col.render ? col.render(row) : formatCell(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </>
        )}
      </tbody>
    </table>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
