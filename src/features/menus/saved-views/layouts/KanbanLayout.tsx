// FR-D2-014 §3's Kanban layout element row, extended past v1's read-only
// scope (Document Control v0.2 explicitly deferred drag-and-drop) to full
// drag support: dragging a card to a different column writes the record's
// group field (a real, validated, triggered field edit — the same
// updateRecord PUT the record-detail drawer's own Edit button uses);
// dragging within a column writes only kanban_order (RecordStore's own
// dedicated, trigger-free position column — see its doc comment for why
// that's a separate write path from a real field edit).
//
// Unlike Card/Calendar/List, Kanban does NOT render RecordsTable's single
// flat `results` page — a flat page/pageSize over the WHOLE filtered result
// set has no way to express "the next 25 rows of just the Won column," so
// each column runs its own independent, infinitely-scrollable query
// (useKanbanColumn), server-filtered to that one enum value, owned by that
// column's own KanbanColumn component instance (NOT called in a .map() at
// this level — a real per-render change in the number of enum options,
// e.g. an admin editing the form's Select while a viewer has this view
// open, would violate rules-of-hooks if these were plain hook calls here).
// This is real per-column infinite scroll, not client-side slicing of one
// shared page.
//
// Grouping is enum-only ("just consider select fields" — a reference field's
// distinct values are an unbounded, paginated list of foreign records, which
// would make drag-to-recolumn an open-ended target picker rather than a
// fixed, small set of columns; out of scope here). SaveViewDialog's
// groupFields filter already enforces this at authoring time.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners,
  useDroppable, DragOverlay, type DragStartEvent, type DragEndEvent, type DragOverEvent,
  type DraggableAttributes, type DraggableSyntheticListeners,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Loader2 } from 'lucide-react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { resolveRecordTitle } from '@/features/forms/runtime/record-title'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { formatFieldValue, formatSystemDatetime } from '@/features/forms/runtime/format-value'
import { RoleValueLabel } from '@/features/forms/runtime/RoleValueLabel'
import { resolveEnumLabel } from '@/features/forms/runtime/enum-labels'
import { FileCellDisplay } from '@/features/forms/runtime/FileCellDisplay'
import { ReferenceValueLabel } from '@/features/forms/runtime/ReferenceValueLabel'
import { useKanbanColumn } from '@/features/forms/runtime/useKanbanColumn'
import { useUpdateRecord } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import type { SearchRecordsResponse } from '@/features/forms/api'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { KanbanLayoutConfig } from '../types'

interface KanbanLayoutProps {
  formId: string
  fields: FieldDef[]
  config: KanbanLayoutConfig
  filter: FilterGroup
  sort: SortRule[]
  /** The view's own visible-columns list — rendered as body rows on each
   *  card, exactly like CardLayout, so switching a saved view between Card
   *  and Kanban shows the same fields either way. */
  columns: string[]
  roleField?: string
  enumLabels: Map<string, Map<string, string>>
  onOpenRecord: (r: FormRecord) => void
  /** Fired when the viewer drags a column header to reorder the board live —
   *  receives the new full ordered list of enum values (every one of the
   *  group field's enum_values, not just the ones currently visible, so a
   *  hidden column's own position is preserved even though it isn't
   *  rendered — reordering only the visible subset would otherwise silently
   *  discard hidden columns' relative order the next time one is unhidden).
   *  Omitted (no drag handle rendered on column headers) for callers that
   *  don't support persisting it — mirrors DataTable's own onColumnsReorder
   *  convention for the List layout's header drag. */
  onColumnOrderChange?: (newOrder: string[]) => void
}

/** Registry a column instance publishes itself into so the board-level drag
 *  handlers can read/mutate any column's live records without calling each
 *  column's own query hook up here (see file-top comment on why). Keyed by
 *  column value; every KanbanColumn keeps its own entry current via a plain
 *  ref write on every render — cheap, and avoids a state round-trip just to
 *  let a sibling read "what does column X currently show." */
type ColumnHandle = { records: FormRecord[]; total: number }

function kanbanColumnQueryKey(formId: string, groupField: string, columnValue: string, filter: FilterGroup, sort: SortRule[]) {
  return ['forms', formId, 'kanban-column', groupField, columnValue, filter, sort] as const
}

export function KanbanLayout({ formId, fields, config, filter, sort, columns, roleField, enumLabels, onOpenRecord, onColumnOrderChange }: KanbanLayoutProps) {
  const t = useTranslation()
  const groupField = fields.find((f) => f.name === config.groupField)
  const bodyFields = columns.map((name) => fields.find((f) => f.name === name)).filter((f): f is FieldDef => !!f)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const updateRecord = useUpdateRecord(formId)
  const qc = useQueryClient()

  // Which record is mid-drag, kept only for the DragOverlay's floating
  // preview — every column's own SortableContext already reflects the live
  // drop target via @dnd-kit's own reordering during handleDragOver.
  const [activeRecord, setActiveRecord] = useState<FormRecord | null>(null)
  // Column key the dragged card currently started in — resolved once at
  // drag start so onDragEnd can tell "did this drop change columns" from
  // "did it just reorder in place," even after handleDragOver's optimistic
  // cache writes have already moved the card between columns' query data.
  const startColumnRef = useRef<string>('')

  // Every enum value in FieldDef order — the fixed superset columnOrder is
  // resolved against below. Kept separate from columnDefs (the RENDERED,
  // ordered-and-filtered set) because a column-reorder drag must preserve
  // hidden columns' own relative position in the full list (see
  // onColumnOrderChange's own doc comment) even though only visible ones
  // ever render a header to drag in the first place.
  const allValues = useMemo(() => (groupField?.type === 'enum' ? (groupField.enum_values ?? []) : []), [groupField])

  // Resolves config.visibleColumns against the field's real, current
  // enum_values: a saved value that's since been renamed/removed off the
  // field is silently dropped (never rendered) rather than producing a
  // broken column; an unset/empty visibleColumns means "every value, in the
  // field's own natural order" — the same tolerant-of-drift resolution
  // KanbanLayoutConfig's own doc comment describes.
  const columnDefs = useMemo(() => {
    if (!groupField || groupField.type !== 'enum') return []
    const ordered = config.visibleColumns && config.visibleColumns.length > 0
      ? config.visibleColumns.filter((v) => allValues.includes(v))
      : allValues
    return ordered.map((v) => ({ key: v, label: resolveEnumLabel(enumLabels, groupField.name, v) }))
  }, [groupField, enumLabels, config.visibleColumns, allValues])

  // A drag's `active.id` is either a column key (one of columnDefs's own
  // values, when the drag started on a header's grip handle) or a record id
  // (a card) — this codebase's enum values and record UUIDs never collide in
  // practice, but checking membership explicitly (rather than assuming
  // "not a UUID shape") keeps this correct even for an enum value that
  // happens to look UUID-like. Memoized here, above the missing/invalid
  // group-field returns below, so every render calls the same hooks.
  const columnKeySet = useMemo(() => new Set(columnDefs.map((c) => c.key)), [columnDefs])

  // Live registry of every column's current records, kept up to date by
  // each KanbanColumn instance itself (see registerRef below) — lets the
  // board-level drag handlers read "what's in column X right now" without
  // owning any query themselves.
  const registryRef = useRef<Map<string, ColumnHandle>>(new Map())
  const registerColumn = (key: string, handle: ColumnHandle) => { registryRef.current.set(key, handle) }

  if (!groupField) {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.kanban.field_missing')}</div>
  }
  if (groupField.type !== 'enum') {
    return <div className="p-8 text-center text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.kanban.field_invalid')}</div>
  }

  function findRecord(id: string): { record: FormRecord; columnKey: string } | undefined {
    for (const [key, handle] of registryRef.current) {
      const rec = handle.records.find((r) => (r.id as string) === id)
      if (rec) return { record: rec, columnKey: key }
    }
    return undefined
  }

  const isColumnDrag = (id: string) => columnKeySet.has(id)

  function handleDragStart(e: DragStartEvent) {
    const id = e.active.id as string
    if (isColumnDrag(id)) return // column drags need no start-side bookkeeping — see handleColumnDragEnd
    const found = findRecord(id)
    if (!found) return
    setActiveRecord(found.record)
    startColumnRef.current = found.columnKey
  }

  // Column headers reorder via @dnd-kit's ordinary single-list SortableContext
  // semantics (no cross-container logic needed — a column can't move "into"
  // a card's own vertical list) — persisted through onColumnOrderChange the
  // same fire-and-forget-to-the-caller way onDragEnd below persists a card's
  // group-field/position writes, letting RecordsTable/SearchMenuRuntime
  // decide whether that means an instant auto-save (List's existing
  // onColumnsReorder behavior) or queuing it behind the unsaved-changes
  // prompt (this feature's whole point) without KanbanLayout itself needing
  // to know which.
  function handleColumnDragEnd(activeId: string, overId: string) {
    if (!onColumnOrderChange || activeId === overId) return
    const oldIndex = allValues.indexOf(activeId)
    const newIndex = allValues.indexOf(overId)
    if (oldIndex === -1 || newIndex === -1) return
    onColumnOrderChange(arrayMove(allValues, oldIndex, newIndex))
  }

  // Live-reorders the dragged card into the column under the pointer, purely
  // client-side (React Query cache), so the card visually follows the
  // pointer across columns while dragging — mirrors any standard multi-list
  // dnd-kit board. The actual persisted write happens once, in handleDragEnd.
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over || isColumnDrag(active.id as string)) return
    const activeId = active.id as string
    const overId = over.id as string

    const fromEntry = [...registryRef.current.entries()].find(([, h]) => h.records.some((r) => (r.id as string) === activeId))
    if (!fromEntry) return
    const [fromKey, fromHandle] = fromEntry
    const toKey = registryRef.current.has(overId)
      ? overId
      : [...registryRef.current.entries()].find(([, h]) => h.records.some((r) => (r.id as string) === overId))?.[0]
    if (!toKey || fromKey === toKey) return
    const toHandle = registryRef.current.get(toKey)
    if (!toHandle) return

    const movedRecord = fromHandle.records.find((r) => (r.id as string) === activeId)
    if (!movedRecord) return
    const overIndex = toHandle.records.findIndex((r) => (r.id as string) === overId)

    qc.setQueryData<InfiniteData<SearchRecordsResponse>>(kanbanColumnQueryKey(formId, config.groupField, fromKey, filter, sort), (data) => {
      if (!data) return data
      return { ...data, pages: data.pages.map((p) => ({ ...p, records: p.records.filter((r) => (r.id as string) !== activeId) })) }
    })
    qc.setQueryData<InfiniteData<SearchRecordsResponse>>(kanbanColumnQueryKey(formId, config.groupField, toKey, filter, sort), (data) => {
      if (!data || data.pages.length === 0) return data
      const insertAt = overIndex >= 0 ? overIndex : data.pages[0].records.length
      const pages = [...data.pages]
      const newRecords = [...pages[0].records]
      newRecords.splice(insertAt, 0, movedRecord)
      pages[0] = { ...pages[0], records: newRecords }
      return { ...data, pages }
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (isColumnDrag(active.id as string)) {
      if (over) handleColumnDragEnd(active.id as string, over.id as string)
      return
    }
    setActiveRecord(null)
    if (!over) return

    const recordId = active.id as string
    const startColumn = startColumnRef.current
    const endedInEntry = [...registryRef.current.entries()].find(([, h]) => h.records.some((r) => (r.id as string) === recordId))
    if (!endedInEntry) return
    const [endedInKey, endedInHandle] = endedInEntry

    // Fractional-index position from wherever the card actually landed.
    // handleDragOver's own optimistic cache writes already reorder
    // endedInHandle.records to match the drop — but ONLY when the pointer
    // crossed into a DIFFERENT column (handleDragOver returns early on
    // `fromKey === toKey`, i.e. a same-column drag). A same-column reorder's
    // visual movement is @dnd-kit's own SortableContext transform animation,
    // which never touches the query cache — so endedInHandle.records at drop
    // time is still in its ORIGINAL, pre-drag order for that case, and needs
    // its own arrayMove here to reflect where the card was actually dropped
    // before reading its new neighbors.
    //
    // Originally only the same-column branch computed and persisted an
    // order at all — a cross-column drop only wrote the group field, never
    // kanban_order, leaving it NULL. NULLs sort last (see buildOrderBy's own
    // NULLS LAST), so a card dropped at the TOP of a new column would render
    // there optimistically for an instant, then jump to the bottom the
    // moment onSettled's invalidate refetched real server-sorted data —
    // dragging it again (now a same-column reorder, which always wrote a
    // real order) "fixed" it, which is what made this read as a
    // same-column-only bug.
    const crossedColumns = endedInKey !== startColumn
    const orderedRecords = crossedColumns
      ? endedInHandle.records
      : (() => {
          const ids = endedInHandle.records.map((r) => r.id as string)
          const oldIndex = ids.indexOf(recordId)
          const overIndex = ids.indexOf(over.id as string)
          return oldIndex === -1 || overIndex === -1 ? endedInHandle.records : arrayMove(endedInHandle.records, oldIndex, overIndex)
        })()
    // Sort is ASC (buildOrderBy), so a smaller kanban_order renders higher
    // in the column. Dropped at the very top (no prevOrder, only a
    // nextOrder neighbor below it) needs a value SMALLER than that
    // neighbor's to actually sort above it — nextOrder - 1, not + 1 (the
    // reverse reads as "insert after," the opposite of where it landed).
    // Symmetrically, dropped at the very bottom needs prevOrder + 1.
    const newIndex = orderedRecords.findIndex((r) => (r.id as string) === recordId)
    const prevOrder = newIndex > 0 ? toOrderNumber(orderedRecords[newIndex - 1]?.kanban_order) : undefined
    const nextOrder = newIndex >= 0 && newIndex < orderedRecords.length - 1 ? toOrderNumber(orderedRecords[newIndex + 1]?.kanban_order) : undefined
    const order = prevOrder !== undefined && nextOrder !== undefined
      ? (prevOrder + nextOrder) / 2
      : prevOrder !== undefined
      ? prevOrder + 1
      : nextOrder !== undefined
      ? nextOrder - 1
      : 0

    if (crossedColumns) {
      // Crossed columns — a real field edit (validated, triggered, audited),
      // exactly like the record-detail drawer's own Edit button, PLUS the
      // position write below — a cross-column drop is always both.
      //
      // Sends ONLY the changed field, not the whole fetched record — this
      // endpoint is a genuine partial patch (RecordStore.Update only builds
      // a SET clause for keys actually present in the body, see its own doc
      // comment), so there is nothing to gain from resubmitting the rest,
      // and doing so actively broke every cross-column move: a `date`-typed
      // field like close_date round-trips from GET as full RFC3339
      // ("2026-11-30T00:00:00Z"), but the validator demands strict
      // YYYY-MM-DD on write — so spreading movedRecord back into the PUT
      // 422'd on any form with a date field, silently reverting the drag
      // (onSettled's invalidate still fired, refetching the unchanged real
      // data) with no visible error.
      updateRecord.mutate(
        { recordId, data: { [config.groupField]: endedInKey } },
        { onSettled: () => qc.invalidateQueries({ queryKey: ['forms', formId, 'kanban-column'] }) },
      )
      formsApi.setKanbanOrder(formId, recordId, order)
      return
    }

    // Reordered within the same column — no field actually changed, so this
    // skips updateRecord entirely and only persists the new position, then
    // invalidates so the server's own kanban_order NULLS LAST ordering
    // becomes the source of truth on next fetch rather than trusting the
    // optimistic local order forever.
    formsApi.setKanbanOrder(formId, recordId, order).finally(() => {
      qc.invalidateQueries({ queryKey: ['forms', formId, 'kanban-column', config.groupField, endedInKey] })
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto p-3">
        <SortableContext items={columnDefs.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
          {columnDefs.map((c) => (
            <KanbanColumn
              key={c.key}
              formId={formId}
              groupFieldName={config.groupField}
              columnKey={c.key}
              label={c.label}
              filter={filter}
              sort={sort}
              fields={fields}
              bodyFields={bodyFields}
              roleField={roleField}
              enumLabels={enumLabels}
              onOpenRecord={onOpenRecord}
              registerColumn={registerColumn}
              draggable={!!onColumnOrderChange}
            />
          ))}
        </SortableContext>
      </div>
      <DragOverlay>
        {activeRecord && (
          <KanbanCard record={activeRecord} fields={fields} bodyFields={bodyFields} roleField={roleField} enumLabels={enumLabels} overlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}

function toOrderNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function KanbanColumn({ formId, groupFieldName, columnKey, label, filter, sort, fields, bodyFields, roleField, enumLabels, onOpenRecord, registerColumn, draggable }: {
  formId: string
  groupFieldName: string
  columnKey: string
  label: string
  filter: FilterGroup
  sort: SortRule[]
  fields: FieldDef[]
  bodyFields: FieldDef[]
  roleField?: string
  enumLabels: Map<string, Map<string, string>>
  onOpenRecord: (r: FormRecord) => void
  registerColumn: (key: string, handle: ColumnHandle) => void
  /** Renders a grip handle on the column header, letting the viewer
   *  drag-reorder columns — omitted (no handle, board order fixed) unless
   *  the caller passed onColumnOrderChange to KanbanLayout, mirroring
   *  DataTable's onColumnsReorder/draggable convention for List's own
   *  header drag. */
  draggable: boolean
}) {
  const t = useTranslation()
  const { records, total, hasNextPage, isFetchingNextPage, fetchNextPage } = useKanbanColumn(formId, filter, sort, groupFieldName, columnKey, true)
  registerColumn(columnKey, { records, total })

  // useSortable subsumes useDroppable (it's built on useDraggable +
  // useDroppable internally) — using it even when !draggable would work, but
  // it also carries drag-transform/listener wiring nothing needs when this
  // column has no grip handle to trigger it from, so a column-drag-disabled
  // board stays on the plain, lighter useDroppable(only-a-drop-target) hook,
  // same as before this feature existed.
  const sortable = useSortable({ id: columnKey, disabled: !draggable })
  const droppableOnly = useDroppable({ id: columnKey })
  const { setNodeRef, isOver } = draggable ? sortable : droppableOnly
  const style = draggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.5 : 1 }
    : undefined

  const sentinelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Infinite scroll: fetch the column's next page once its bottom sentinel
  // enters the scrollable list's viewport — the same lazy-load-on-approach
  // pattern any standard infinite list uses, scoped to this one column's own
  // scroll container rather than the page.
  useObserveSentinel(sentinelRef, listRef, !!hasNextPage && !isFetchingNextPage, fetchNextPage)

  return (
    <div
      ref={setNodeRef}
      data-slot="kanban-column"
      data-over={isOver ? 'true' : undefined}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg border p-2 transition-colors',
        isOver ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]',
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-1 px-1">
        <div className="flex min-w-0 items-center gap-1">
          {draggable && (
            <span
              {...sortable.attributes}
              {...sortable.listeners}
              className="cursor-grab touch-none hover:opacity-70 active:cursor-grabbing"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <GripVertical size={12} />
            </span>
          )}
          <span data-slot="kanban-column-title" className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{label}</span>
        </div>
        <span data-slot="kanban-count" className="shrink-0 rounded-full bg-[hsl(var(--background))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{total}</span>
      </div>
      <div ref={listRef} className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto">
        <SortableContext items={records.map((r) => r.id as string)} strategy={verticalListSortingStrategy}>
          {records.map((r) => (
            <SortableKanbanCard
              key={r.id as string}
              record={r}
              fields={fields}
              bodyFields={bodyFields}
              roleField={roleField}
              enumLabels={enumLabels}
              onOpenRecord={onOpenRecord}
            />
          ))}
        </SortableContext>
        {records.length === 0 && !isFetchingNextPage && (
          <div className="px-1 py-2 text-center text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.kanban.column_empty')}</div>
        )}
        <div ref={sentinelRef} />
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-2">
            <Loader2 size={14} className="animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
          </div>
        )}
      </div>
    </div>
  )
}

// IntersectionObserver-driven "load more" — observes `sentinelRef` against
// `rootRef`'s own scroll container (not the page viewport) so each column
// loads its next page independently as THAT column is scrolled, not
// whichever column happens to be visible on the page.
function useObserveSentinel(sentinelRef: React.RefObject<HTMLDivElement | null>, rootRef: React.RefObject<HTMLDivElement | null>, enabled: boolean, onIntersect: () => void) {
  const onIntersectRef = useRef(onIntersect)
  onIntersectRef.current = onIntersect

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = rootRef.current
    if (!sentinel || !enabled) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) onIntersectRef.current() },
      { root, rootMargin: '80px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}

function SortableKanbanCard(props: { record: FormRecord; fields: FieldDef[]; bodyFields: FieldDef[]; roleField?: string; enumLabels: Map<string, Map<string, string>>; onOpenRecord: (r: FormRecord) => void }) {
  const { record, onOpenRecord } = props
  const id = record.id as string
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  // attributes/listeners/setNodeRef go directly onto KanbanCard's own
  // <button> now, not a wrapping <div> — dnd-kit's `attributes` include
  // role="button"/tabIndex, which on a plain div around a real <button>
  // produced an invalid nested-interactive (button-in-button) element: a
  // screen reader and keyboard user got two ambiguous stops for one card.
  // A real <button> is already focusable/keyboard-operable on its own, so
  // spreading dnd-kit's attributes onto it directly is safe and leaves
  // exactly one interactive element in the DOM per card.
  return (
    <KanbanCard
      {...props}
      onClick={() => onOpenRecord(record)}
      dragRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      dragStyle={style}
    />
  )
}

function KanbanCard({ record, fields, bodyFields, roleField, enumLabels, onClick, overlay, dragRef, dragAttributes, dragListeners, dragStyle }: {
  record: FormRecord
  fields: FieldDef[]
  bodyFields: FieldDef[]
  roleField?: string
  enumLabels: Map<string, Map<string, string>>
  onClick?: () => void
  overlay?: boolean
  dragRef?: (node: HTMLElement | null) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  dragStyle?: React.CSSProperties
}) {
  const title = resolveRecordTitle(fields, record)
  return (
    <button
      ref={dragRef}
      type="button"
      onClick={onClick}
      data-slot="kanban-card"
      className="flex w-full cursor-grab flex-col gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-left text-xs transition-colors hover:bg-[hsl(var(--accent))] active:cursor-grabbing"
      style={{
        ...dragStyle,
        boxShadow: overlay ? '0 8px 24px -8px rgb(0 0 0 / 0.35)' : undefined,
        cursor: overlay ? 'grabbing' : undefined,
      }}
      {...dragAttributes}
      {...dragListeners}
    >
      <span data-slot="kanban-card-title" className="truncate font-medium text-[hsl(var(--foreground))]">{title}</span>
      {bodyFields.length > 0 && (
        <div data-slot="kanban-card-fields" className="flex flex-col gap-1 border-t border-[hsl(var(--border))] pt-1.5">
          {bodyFields.map((f) => (
            <div key={f.name} className="flex items-center justify-between gap-2 text-[11px]">
              <span data-slot="kanban-card-label" className="shrink-0 text-[hsl(var(--muted-foreground))]">{f.label}</span>
              <span data-slot="kanban-card-value" data-type={f.type} className="truncate text-right text-[hsl(var(--foreground))]">
                {f.name === 'created_at' || f.name === 'updated_at'
                  ? formatSystemDatetime(record[f.name])
                  : f.name === roleField
                  ? <RoleValueLabel roleId={record[f.name]} />
                  : f.type === 'enum'
                  ? resolveEnumLabel(enumLabels, f.name, record[f.name])
                  : f.type === 'file'
                  ? <FileCellDisplay value={record[f.name]} />
                  : f.type === 'reference'
                  ? <ReferenceValueLabel formId={f.reference_table} recordId={record[f.name]} displayField={f.display_field} />
                  : formatFieldValue(record[f.name], f.type, f.number_format)}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
