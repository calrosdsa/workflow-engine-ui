import { ArrowUp, ArrowDown, ArrowUpDown, GripVertical } from 'lucide-react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, onKeyboardActivate } from '@/lib/utils'

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
  /** Opt-in double-click handler, independent of onRowClick — e.g.
   *  RecordsTable.tsx wires single-click to open its own drawer and
   *  double-click to navigate to the full record page instead. Omitted
   *  entirely (no behavior change) for every consumer that doesn't pass it. */
  onRowDoubleClick?: (row: Record<string, unknown>) => void
  /** Narrows which rows actually respond to onRowClick/onRowDoubleClick —
   *  e.g. a report viewer whose rows are a mix of clickable (carry a source
   *  record id) and non-clickable (an aggregate row, a total row) ones.
   *  Omitted entirely: every row with a click handler is activatable, the
   *  original all-or-nothing behavior every existing caller still gets. The
   *  click handlers themselves are still wired unconditionally either way —
   *  this only gates the activatable STYLING (cursor, hover, focus ring,
   *  keyboard tab stop) so a non-clickable row doesn't look clickable. */
  isRowClickable?: (row: Record<string, unknown>) => boolean
  emptyMessage?: string
  /** Renders skeleton placeholder rows instead of `rows` — lets every
   *  consumer (search lists, audit/linked-record tabs) share one loading
   *  treatment instead of each hand-rolling a "Loading…" string. */
  loading?: boolean
  /** Opt-in drag handle on each header cell, letting the viewer reorder
   *  columns by dragging — omitted entirely (no handle rendered, no drag
   *  behavior) for every consumer that doesn't pass it, so this stays a
   *  no-op for existing callers (dashboard table widget, audit/linked-record
   *  tabs). Used by RecordsTable's saved-view "List" layout (FR-D2-014) to
   *  let a viewer reorder a saved view's columns; onReorder receives the
   *  full new column-key order. */
  onColumnsReorder?: (newColumnKeys: string[]) => void
  /** Optional summary row rendered in a <tfoot>, below the body — one entry
   *  per column key; a column absent from the map renders a blank cell.
   *  Omitted entirely (no <tfoot> at all) for every caller that doesn't
   *  pass it, so this is a no-op everywhere except the dashboard table
   *  widget's own opt-in footerAggregates config. */
  footer?: Record<string, React.ReactNode>
}

// A plain native <table>, not a Radix primitive — there's no accessible-
// primitives gap to fill for tabular data (same reasoning select.tsx's
// native <select> variant already demonstrates elsewhere in this codebase).
export function DataTable({ columns, rows, getRowId, sortField, sortDir, onSortChange, onRowClick, onRowDoubleClick, isRowClickable, emptyMessage, loading, onColumnsReorder, footer }: DataTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || !onColumnsReorder) return
    const oldIndex = columns.findIndex((c) => c.key === active.id)
    const newIndex = columns.findIndex((c) => c.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onColumnsReorder(arrayMove(columns, oldIndex, newIndex).map((c) => c.key))
  }

  const headerRow = (
    <tr className="border-b" style={{ borderColor: 'hsl(var(--border))' }}>
      {columns.map((col) => (
        <DataTableHeaderCell key={col.key} col={col} sortField={sortField} sortDir={sortDir} onSortChange={onSortChange} draggable={!!onColumnsReorder} />
      ))}
    </tr>
  )

  const table = (
    <table className="w-full border-collapse text-sm">
      <thead>
        {onColumnsReorder ? (
          <SortableContext items={columns.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
            {headerRow}
          </SortableContext>
        ) : (
          headerRow
        )}
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b" style={{ borderColor: 'hsl(var(--border))' }}>
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  <div className="h-4 w-full max-w-32 animate-pulse rounded bg-[hsl(var(--muted))]" />
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
            {rows.map((row) => {
              const activatable = (onRowClick || onRowDoubleClick) && (!isRowClickable || isRowClickable(row))
              return (
                <tr
                  key={getRowId(row)}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                  tabIndex={activatable ? 0 : undefined}
                  onKeyDown={activatable ? onKeyboardActivate(() => (onRowClick ?? onRowDoubleClick)?.(row)) : undefined}
                  className={cn(
                    'border-b transition-colors',
                    activatable &&
                      'cursor-pointer hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))]',
                  )}
                  style={{ borderColor: 'hsl(var(--border))' }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 py-2', col.align === 'right' && 'text-right')}>
                      {col.render ? col.render(row) : formatCell(row[col.key])}
                    </td>
                  ))}
                </tr>
              )
            })}
          </>
        )}
      </tbody>
      {footer && !loading && (
        <tfoot>
          <tr className="border-t font-medium" style={{ borderColor: 'hsl(var(--border))' }}>
            {columns.map((col) => (
              <td key={col.key} className={cn('px-3 py-2', col.align === 'right' && 'text-right')}>
                {footer[col.key] ?? ''}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )

  // DndContext renders its own accessibility DOM (screen-reader description
  // + focus-restore helpers) as real children, not portaled — nesting it
  // INSIDE <thead> (as an earlier version of this component did) put those
  // divs as siblings of <tr>, which is invalid HTML a <thead> can't contain
  // and triggers a React hydration-mismatch warning. Wrapping the whole
  // <table> instead keeps DndContext's own output outside every table
  // element, while SortableContext (a context provider with no DOM output
  // of its own) still wraps just the header row.
  return onColumnsReorder ? (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {table}
    </DndContext>
  ) : (
    table
  )
}

function DataTableHeaderCell({ col, sortField, sortDir, onSortChange, draggable }: {
  col: DataTableColumn
  sortField?: string
  sortDir?: 'asc' | 'desc'
  onSortChange?: (field: string) => void
  draggable: boolean
}) {
  // useSortable is always called (rules of hooks) but its drag wiring is only
  // spread onto the element when draggable — an undraggable header stays a
  // plain <th> with zero @dnd-kit-attributable behavior or DOM attributes.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key })
  const style = draggable ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 } : undefined

  return (
    <th
      ref={draggable ? setNodeRef : undefined}
      style={{ color: 'hsl(var(--muted-foreground))', ...style }}
      className={cn('px-3 py-2 font-medium', col.align === 'right' ? 'text-right' : 'text-left')}
    >
      <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
        {draggable && (
          <span {...attributes} {...listeners} className="cursor-grab touch-none text-[hsl(var(--muted-foreground))]/50 hover:text-[hsl(var(--muted-foreground))] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1">
            <GripVertical size={12} />
          </span>
        )}
        {col.sortable ? (
          <button onClick={() => onSortChange?.(col.key)} className="flex items-center gap-1 hover:opacity-80">
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
      </div>
    </th>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
