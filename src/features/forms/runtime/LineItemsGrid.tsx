// Editable grid for a Line Items field — the runtime counterpart to the form
// builder's LineItemsColumnsEditor. Renders one summary row per child
// record; clicking a row (or "Add Row") opens a sidebar with that row's full
// fields, matching data-table.tsx's plain-<table> convention for the summary
// (no grid library) plus components/ui/drawer.tsx for the editor. A column
// that is itself a Line Items grid renders, inside the sidebar, as a nested
// LineItemsGrid — opening one of ITS rows stacks a second sidebar on top,
// recursively, with no depth limit (each Drawer is its own Radix root, so
// multiple mount and stack independently).
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useQuery } from '@tanstack/react-query'
import {
  GripVertical, Plus, Copy, Trash2, Check, ChevronsUpDown, Loader2, FileText, Pencil, Search, X, PackageOpen,
} from 'lucide-react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useForm as useFormDef, useUpdateRecord } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { usePermission } from '@/features/auth/permissions'
import { formatValue } from './format-value'
import { resolveReferenceLabel } from './record-title'
import { ReferenceValueLabel } from './ReferenceValueLabel'
import { COLUMN_LAYOUTS } from '@/features/form-builder/schema'
import { iterLineItemElements } from '@/features/form-builder/lineItemsSync'
import { parseLayout } from '@/features/form-builder/serialize'
import type { LineItemSection, FormElement, FormColumn, ComponentType } from '@/features/form-builder/schema'
import type { FormRecord, FieldDef, FieldType, FormDefinition } from '@/features/forms/types'
import type { FilterGroup } from '@/features/workflows/types'

// Best-fit ComponentType for a backend FieldType, used ONLY to render an
// ADOPTED form's own real fields as grid columns (see fieldDefToElement) —
// several ComponentTypes can map to the same FieldType (e.g. 'text' and
// 'password' are both 'string'), so this is deliberately an approximation,
// not a lossless reverse of component-registry.ts. Good enough for
// rendering an input in RowFieldInput; the adopted form's OWN builder page
// is still the actual source of truth for how each field looks there.
const FIELD_TYPE_TO_COMPONENT: Partial<Record<FieldType, ComponentType>> = {
  string: 'text', text: 'textarea', integer: 'number', decimal: 'number',
  boolean: 'checkbox', date: 'date', time: 'time', datetime: 'datetime',
  email: 'email', phone: 'phone', json: 'multiselect', file: 'file',
  enum: 'select', reference: 'form',
}

/** Converts an adopted form's real FieldDef[] into synthetic FormElement[] as
 *  a FALLBACK ONLY — used when a field has no matching element in that form's
 *  own parsed layout (e.g. a field added outside the builder, or pre-builder
 *  legacy data with no layout at all). Deliberately a crude approximation
 *  (placeholder/help text/select styling/etc. are all lost), not a lossless
 *  reverse of component-registry.ts — adoptedFormSections below prefers the
 *  form's real authored elements whenever one exists for a given field. */
function fieldDefToElement(f: FieldDef): FormElement | null {
  const component = FIELD_TYPE_TO_COMPONENT[f.type]
  if (!component) return null
  return {
    id: f.name,
    component,
    label: f.label,
    key: f.name,
    column: f.column,
    validation: {},
    behavior: { visibility: 'always', required: f.required ? 'always' : 'optional', readOnly: 'editable' },
    appearance: { width: 'full' },
    binding: { source: 'none' },
    options: f.enum_values?.map((v) => ({ label: v, value: v })),
    formRef: f.type === 'reference' ? f.reference_table : undefined,
    displayField: f.display_field,
  }
}

/** Builds an adopted grid's row-editor sections from the adopted form's OWN
 *  real builder layout — same sections/columns arrangement and same element
 *  config (placeholder, help text, validation, select options, etc.) as that
 *  form's own page — instead of a flat one-column list of crude
 *  FieldDef-only approximations. Falls back to fieldDefToElement per field
 *  only when that field has no matching element in the parsed layout (no
 *  authored layout at all, or a field the builder never saw). The adopted
 *  form's own reference-back field is excluded everywhere — it's plumbing
 *  (which parent this row belongs to), not a user-facing row column. */
function adoptedFormSections(adoptedForm: FormDefinition, referenceField: string | undefined): LineItemSection[] {
  // parseLayout may return the adopted form's OWN cached schema object
  // (react-query's `layout` reference, unchanged) when layout is already a
  // parsed object rather than a JSON string — every section/column/elements
  // array below is rebuilt fresh rather than filtered in place, so this never
  // mutates that shared cache (which would otherwise silently corrupt the
  // adopted form's own builder page).
  const schema = parseLayout(adoptedForm.layout)
  const layoutKeys = new Set<string>()
  const sections: LineItemSection[] = []
  for (const section of schema.sections) {
    const columns: FormColumn[] = section.columns.map((column) => ({
      ...column,
      elements: column.elements.filter((el) => {
        if (el.key === referenceField) return false
        layoutKeys.add(el.key)
        return true
      }),
    }))
    if (columns.some((c) => c.elements.length > 0)) {
      sections.push({ ...section, columns })
    }
  }

  const leftover = adoptedForm.fields
    .filter((f) => f.name !== referenceField && !layoutKeys.has(f.name))
    .map(fieldDefToElement)
    .filter((e): e is FormElement => e !== null)
  if (leftover.length > 0) {
    sections.push({ id: '__adopted_leftover__', title: '', layout: '1', columns: [{ id: '__adopted_leftover_col__', ratio: 1, elements: leftover }], collapsed: false })
  }
  return sections
}

type Row = FormRecord & { _row_key: string }

interface LineItemsConfigLike {
  displayMode?: 'table' | 'cards'
  rowEditMode?: 'sidebar' | 'inline'
  tableHeight?: number
  stickyHeader?: boolean
  alternateRowColors?: boolean
  compactMode?: boolean
  allowAddRows?: boolean
  allowDeleteRows?: boolean
  allowDuplicateRows?: boolean
  allowReorderRows?: boolean
  allowResize?: boolean
  minRows?: number
  maxRows?: number
}

interface LineItemsGridProps {
  sections: LineItemSection[]
  config: LineItemsConfigLike
  field: { value: unknown; onChange: (v: unknown) => void }
  disabled: boolean
  /** When set, an existing row's edits save directly to its own record
   *  (an adopted row's independent save path) instead of only updating the
   *  local field.value array — see LineItemsGrid's doc comment on why. */
  saveRowIndependently?: (rowId: string, patch: FormRecord) => void
  /** True for an adopted grid — an existing row then opens the full
   *  RecordDetailPanel (Details/Audit Log/Linked Records) instead of the
   *  lightweight field-only sidebar, since it's a real independent record.
   *  A brand-new draft row (no id yet) always uses the lightweight sidebar
   *  regardless, since it isn't a real record until confirmed. */
  isAdopted?: boolean
  /** The adopted form's own id — RecordDetailPanel's formId when opening an
   *  existing adopted row's full detail view. */
  adoptedFormRef?: string
  /** The adopted form's own definition (fields + layout) — RecordDetailPanel's
   *  `fields`/`schema` props when opening an existing adopted row. */
  adoptedForm?: FormDefinition
  /** The form whose permission catalog governs add/edit/delete/duplicate on
   *  THIS grid — see LineItemsGrid's doc comment on why it differs for
   *  adopted vs. generated. Undefined means "no permission context available"
   *  (e.g. FormRendererHarness, a dev-only tool with no real form/membership)
   *  — checks are skipped entirely in that case rather than resolving to
   *  hasPermission([], need) === false, which would make every row action
   *  permanently blocked with no real form to attribute the denial to. This
   *  is UI polish only either way; the backend re-validates every request
   *  regardless of what this computes. */
  effectiveFormId?: string
}

// _row_key rides along inside field.value (unlike a typical "strip before
// save" scratch field, it is deliberately NOT removed before onChange)
// specifically so it survives the round-trip through react-hook-form's
// onChange/re-render cycle with a STABLE identity. It has to: a brand-new
// row has no `id` yet (only assigned once the record is actually saved), so
// re-minting a fresh nanoid() on every render — as an earlier version of
// this function did — meant a row added via addRow() never matched the key
// addRow() had just told setEditingRowKey to open, silently no-op'ing
// "Add Row" for any not-yet-saved row. The backend ignores unrecognized
// keys when inserting (see RecordStore.Insert), so carrying `_row_key`
// along in the submitted payload is harmless.
function toRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return []
  return (value as FormRecord[]).map((r) => ({ ...r, _row_key: (r._row_key as string) ?? (r.id as string) ?? nanoid() }))
}

/** Adapter so FieldRenderer's `el: FormElement` call site (the top-level
 *  canvas element) and LineItemsColumnsEditor's nested `field.lineItemColumns`
 *  call site (a nested grid field) can both render the same grid — both
 *  shapes already carry the same lineItemColumns/lineItemConfig fields.
 *
 *  When sourceMode is 'existing' (adopted), the grid's columns come from the
 *  adopted form's OWN real fields (fetched here, converted via
 *  fieldDefToElement) instead of the authored lineItemColumns — a single
 *  synthetic section/column wrapping all of them, since an adopted form has
 *  no authored section/column layout of its own to mirror (unlike a
 *  generated child's LineItemsColumnsEditor-authored sections). */
export function LineItemsGrid({ el, field, parentFormId, disabled }: {
  el: {
    lineItemColumns?: LineItemSection[]
    lineItemConfig?: LineItemsConfigLike
    sourceMode?: 'generated' | 'existing'
    adoptedFormRef?: string
    adoptedReferenceField?: string
  }
  field: { value: unknown; onChange: (v: unknown) => void }
  /** The form this Line Items field itself lives on (the outer record being
   *  viewed/edited). Used to permission-check row actions for a GENERATED
   *  grid, which has no permission catalog entry of its own — see
   *  effectiveFormId below. Optional because a couple of call sites
   *  (FormRendererHarness) have no real form context. */
  parentFormId?: string
  disabled: boolean
}) {
  const isAdopted = el.sourceMode === 'existing'
  const { data: adoptedForm, isLoading: adoptedLoading } = useFormDef(isAdopted ? (el.adoptedFormRef ?? '') : '')
  const updateAdoptedRecord = useUpdateRecord(isAdopted ? (el.adoptedFormRef ?? '') : '')

  // The form whose permission catalog actually governs this grid's row
  // actions. An ADOPTED row is an independent record of its own form — it
  // has its own forms:{id}:{action} entries, so THAT'S what's checked. A
  // GENERATED row has no permission entry of its own (auth/permissions.go
  // explicitly excludes is_line_items forms from the catalog) — it falls
  // back to the parent's own permission, since a generated row only ever
  // writes through the parent's save.
  const effectiveFormId = isAdopted ? el.adoptedFormRef : parentFormId

  const sections = useMemo<LineItemSection[]>(() => {
    if (!isAdopted) return el.lineItemColumns ?? []
    if (!adoptedForm) return []
    return adoptedFormSections(adoptedForm, el.adoptedReferenceField)
  }, [isAdopted, adoptedForm, el.lineItemColumns, el.adoptedReferenceField])

  if (isAdopted && adoptedLoading) {
    return <GridSkeleton />
  }

  // An ADOPTED row is an ordinary, independent record of its own form — it
  // doesn't need the parent record to be in edit mode to be edited; it has
  // its own save path (PUT to its own form/record endpoint). A read-only
  // context (disabled=true, e.g. the record Details tab before its own
  // "Edit" button is clicked) still blocks add/delete/duplicate/reorder on
  // THIS grid — those really do belong to the parent's own edit/save flow —
  // but an already-existing adopted row's own fields stay editable, saved
  // independently the moment they change. A GENERATED row has no save path
  // of its own (it only ever writes through the parent's own save), so it
  // stays fully read-only here, same as before.
  const saveRowIndependently = isAdopted && disabled
    ? (rowId: string, patch: FormRecord) => updateAdoptedRecord.mutate({ recordId: rowId, data: patch })
    : undefined

  return (
    <LineItemsGridInner
      sections={sections}
      config={el.lineItemConfig ?? {}}
      field={field}
      disabled={disabled}
      saveRowIndependently={saveRowIndependently}
      isAdopted={isAdopted}
      adoptedFormRef={el.adoptedFormRef}
      adoptedForm={adoptedForm}
      effectiveFormId={effectiveFormId}
    />
  )
}

/** Loading placeholder shown while an adopted grid resolves its target
 *  form. Shaped like the table it's about to become (header bar + three row
 *  bars) rather than a spinner, so the layout doesn't visibly jump once the
 *  real content mounts — the point of a skeleton over a spinner is exactly
 *  this continuity. */
function GridSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))]">
      <Skeleton className="h-8 w-full rounded-none" />
      <div className="divide-y divide-[hsl(var(--border))]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: `${70 - i * 15}%` }} />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Columns whose values are worth summing in the totals footer — numeric
// entry components only. 'line_item_count' is technically numeric but reads
// as a derived rollup, not a value the user is entering per row, so it's
// excluded to avoid double-counting a total-of-totals.
const SUMMABLE_COMPONENTS = new Set<ComponentType>(['number'])

function sumColumn(rows: Row[], key: string): number {
  let total = 0
  for (const row of rows) {
    const v = row[key]
    if (typeof v === 'number' && Number.isFinite(v)) total += v
  }
  return total
}

function LineItemsGridInner({
  sections, config: cfg, field, disabled, saveRowIndependently,
  isAdopted, adoptedFormRef, adoptedForm, effectiveFormId,
}: LineItemsGridProps) {
  const columns = useMemo(() => [...iterLineItemElements(sections)], [sections])
  const allRows = toRows(field.value)
  // usePermission must run unconditionally (rules of hooks) — a fixed
  // placeholder resource is passed when effectiveFormId is unknown, and its
  // result is simply ignored (treated as allowed) in that case, since
  // hasPermission([], need) resolves false and there's no real form to
  // attribute a denial to. See LineItemsGridProps.effectiveFormId's doc
  // comment for why this is UI polish only, not the security boundary.
  const canCreatePerm = usePermission(effectiveFormId ? `forms:${effectiveFormId}:create` : 'forms:*:create')
  const canEditPerm = usePermission(effectiveFormId ? `forms:${effectiveFormId}:edit` : 'forms:*:edit')
  const canDeletePerm = usePermission(effectiveFormId ? `forms:${effectiveFormId}:delete` : 'forms:*:delete')
  const hasCreatePermission = !effectiveFormId || canCreatePerm
  const hasEditPermission = !effectiveFormId || canEditPerm
  const hasDeletePermission = !effectiveFormId || canDeletePerm
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null)
  // An EXISTING adopted row (real id, real independent record) opens the
  // full RecordDetailPanel here instead of editingRowKey's lightweight
  // field-only sidebar — see LineItemsGridProps.isAdopted's doc comment.
  // Never set for a draft row (no id yet) or a generated row (no
  // independent existence) — those always go through editingRowKey.
  const [viewingRowId, setViewingRowId] = useState<string | null>(null)
  // A row started via "Add Row" lives here — NOT in field.value/allRows —
  // until the sidebar is confirmed with "Done". Editing an EXISTING row
  // (opened via the pencil icon) never touches this; it live-updates
  // allRows directly as before, since that row is already real. Without this
  // split, clicking "+ Add Row" would immediately commit a blank row into
  // the record's data even if the user closed the sidebar without entering
  // anything (Escape, the X button, clicking the overlay) — the row should
  // only become real once the user actually confirms it from the sidebar.
  const [draftRow, setDraftRow] = useState<Row | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [colWidths, setColWidths] = useState<Record<string, number>>({})

  const searchableCols = useMemo(() => columns.filter((c) => c.component !== 'line_items'), [columns])
  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return allRows
    return allRows.filter((row) =>
      searchableCols.some((c) => String(formatValue(row[c.key]) ?? '').toLowerCase().includes(q)),
    )
  }, [allRows, debouncedSearch, searchableCols])

  // Both gates apply: the builder-configured allowX flag (can this grid do
  // this at all) AND the current user's real permission on the row's own
  // form (create for add/duplicate — a duplicate is a new row underneath —
  // edit for reorder, delete for delete/bulk-delete).
  const canAdd = cfg.allowAddRows !== false && !disabled && hasCreatePermission
  const canDelete = cfg.allowDeleteRows !== false && !disabled && hasDeletePermission
  const canDuplicate = cfg.allowDuplicateRows !== false && !disabled && hasCreatePermission
  const canReorder = cfg.allowReorderRows !== false && !disabled && hasEditPermission && allRows.length > 1 && !debouncedSearch.trim()
  const canResize = cfg.allowResize !== false && (cfg.displayMode ?? 'table') === 'table'
  // Bulk select/delete rides on the same allowDeleteRows permission as a
  // single-row delete — there's no separate "bulk" grant, since selecting
  // rows to delete several at once isn't a distinct capability from deleting
  // them one at a time.
  const canSelect = canDelete
  const atMax = cfg.maxRows !== undefined && allRows.length >= cfg.maxRows
  const atMin = cfg.minRows !== undefined && allRows.length <= cfg.minRows
  // A bulk delete that would leave fewer than minRows is blocked entirely
  // (rather than partially applying it) — same "respect the floor" stance
  // atMin already takes for a single-row delete.
  const minRows = cfg.minRows ?? 0

  const setRows = (next: Row[]) => field.onChange(next)

  // Opens the sidebar on a brand-new, not-yet-committed row — see draftRow's
  // doc comment. Nothing is appended to field.value here. A no-op while a
  // draft is already open (rather than silently replacing it) — the sidebar
  // covers the "+ Add Row" button in every current display mode, but this
  // guards against it regardless.
  const addRow = () => {
    if (atMax || draftRow) return
    const key = nanoid()
    setDraftRow({ _row_key: key })
    setEditingRowKey(key)
  }
  // Dispatches a row click to the right view: an existing adopted row (real
  // id, real independent record — see LineItemsGridProps.isAdopted) opens
  // the full RecordDetailPanel; everything else (a draft row or a generated
  // row) opens the lightweight field-only sidebar, exactly as before.
  const openRow = (row: Row) => {
    if (isAdopted && row.id) {
      setViewingRowId(row.id as string)
      return
    }
    setEditingRowKey(row._row_key)
  }
  // The sidebar's "Done" for a draft row: commits it into field.value for
  // the first time. For an existing row it's a no-op (there's no draft to
  // commit — the row's already been live in allRows since it was opened).
  const commitDraftRow = () => {
    if (!draftRow) return
    setRows([...allRows, draftRow])
    setDraftRow(null)
  }
  // Any other way of leaving the sidebar (X button, Escape, overlay click)
  // while a draft is in progress — discards it instead of committing.
  const discardDraftRow = () => setDraftRow(null)
  const deleteRow = (rowKey: string) => {
    if (atMin) return
    setRows(allRows.filter((r) => r._row_key !== rowKey))
    setSelected((prev) => {
      if (!prev.has(rowKey)) return prev
      const next = new Set(prev)
      next.delete(rowKey)
      return next
    })
  }
  const toggleSelected = (rowKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r._row_key))))
  }
  const deleteSelected = () => {
    if (allRows.length - selected.size < minRows) return
    setRows(allRows.filter((r) => !selected.has(r._row_key)))
    setSelected(new Set())
  }
  const duplicateRow = (rowKey: string) => {
    if (atMax) return
    const idx = allRows.findIndex((r) => r._row_key === rowKey)
    if (idx === -1) return
    const copy: Row = { ...allRows[idx], _row_key: nanoid(), id: undefined }
    setRows([...allRows.slice(0, idx + 1), copy, ...allRows.slice(idx + 1)])
  }
  // Live-updates the row being edited in the sidebar. A not-yet-committed
  // draft row updates the separate draftRow state (field.value stays
  // untouched until commitDraftRow runs). An existing row normally updates
  // allRows directly (as before) — EXCEPT when saveRowIndependently is set
  // (an adopted row edited from a read-only context, e.g. the record
  // Details tab): there, field.onChange has nowhere to go (disabled means
  // the surrounding form isn't being submitted), so the edit is persisted
  // straight to that row's own record instead. allRows is still updated
  // too so the grid reflects the change immediately rather than waiting on
  // the mutation to settle and a refetch to land.
  const updateRow = (rowKey: string, patch: FormRecord) => {
    if (draftRow && draftRow._row_key === rowKey) {
      setDraftRow({ ...draftRow, ...patch })
      return
    }
    const row = allRows.find((r) => r._row_key === rowKey)
    if (saveRowIndependently && row?.id) {
      // A record PUT fully replaces the row's fields (same as the parent
      // form's own "Save") — sending only `patch` would blank out every
      // other field the sidebar isn't currently touching, including the
      // adopted form's own required reference-back field. _row_key is this
      // component's scratch id, never a real field on the adopted form.
      const { _row_key, ...merged } = { ...row, ...patch }
      saveRowIndependently(row.id as string, merged)
    }
    setRows(allRows.map((r) => (r._row_key === rowKey ? { ...r, ...patch } : r)))
  }
  const resizeColumn = (colId: string, width: number) => {
    setColWidths((prev) => ({ ...prev, [colId]: Math.max(72, width) }))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = allRows.findIndex((r) => r._row_key === active.id)
    const newIndex = allRows.findIndex((r) => r._row_key === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setRows(arrayMove(allRows, oldIndex, newIndex))
  }

  if (columns.length === 0) {
    return (
      <EmptyPanel icon={PackageOpen} title="No columns configured" hint="Add a column to this Line Items field to start entering rows." />
    )
  }

  const showSearch = allRows.length > 5 && searchableCols.length > 0
  const summableCols = columns.filter((c) => SUMMABLE_COMPONENTS.has(c.component))
  const showFooter = (cfg.displayMode ?? 'table') === 'table' && summableCols.length > 0 && allRows.length > 0

  const tableStyle = cfg.tableHeight ? { maxHeight: cfg.tableHeight, overflowY: 'auto' as const } : undefined
  const rowPad = cfg.compactMode ? 'py-1.5' : 'py-2.5'
  const editingRow = editingRowKey ? (draftRow?._row_key === editingRowKey ? draftRow : allRows.find((r) => r._row_key === editingRowKey)) : undefined
  const editingIsDraft = !!draftRow && draftRow._row_key === editingRowKey
  // The sidebar's own fields are editable whenever the grid itself isn't
  // disabled, OR this is an existing (non-draft) row with an independent
  // save path — see updateRow's doc comment. Everything else in the grid
  // (add/delete/duplicate/reorder, the summary table's own cells) keeps
  // using the plain `disabled` flag unchanged.
  const sidebarDisabled = disabled && !(saveRowIndependently && !editingIsDraft)
  const colCount = columns.length + (canReorder ? 1 : 0) + (canSelect ? 1 : 0) + 1
  const bulkDeleteDisabled = allRows.length - selected.size < minRows

  return (
    <div className="space-y-2.5">
      {(showSearch || (canSelect && selected.size > 0)) && (
        <div className="flex items-center justify-between gap-3">
          {showSearch ? (
            <div className="relative w-full max-w-[220px]">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rows…"
                aria-label="Search rows"
                className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] py-1 pl-8 pr-7 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ) : <div />}
          {canSelect && selected.size > 0 && (
            <div className="flex animate-in fade-in-0 items-center gap-3 duration-150">
              <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{selected.size} selected</span>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={bulkDeleteDisabled}
                title={bulkDeleteDisabled ? `Can't delete below the minimum of ${minRows} row(s)` : undefined}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[hsl(var(--destructive))] transition-colors hover:bg-[hsl(var(--destructive))]/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {allRows.length === 0 ? (
        <EmptyPanel
          icon={PackageOpen}
          title="No rows yet"
          hint={canAdd ? 'Add your first row to get started.' : 'This grid has no rows.'}
          action={canAdd ? { label: 'Add Row', onClick: addRow } : undefined}
        />
      ) : rows.length === 0 ? (
        <EmptyPanel icon={Search} title="No matching rows" hint={`Nothing matches "${debouncedSearch}".`} />
      ) : cfg.displayMode === 'cards' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r._row_key)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2 sm:grid-cols-2" style={tableStyle}>
              {rows.map((row) => (
                <CardRow
                  key={row._row_key}
                  row={row}
                  columns={columns}
                  canReorder={canReorder}
                  canDelete={canDelete}
                  canDuplicate={canDuplicate}
                  canSelect={canSelect}
                  isSelected={selected.has(row._row_key)}
                  atMin={atMin}
                  atMax={atMax}
                  isInline={cfg.rowEditMode === 'inline'}
                  disabled={disabled}
                  onEdit={() => openRow(row)}
                  onDelete={() => deleteRow(row._row_key)}
                  onDuplicate={() => duplicateRow(row._row_key)}
                  onToggleSelected={() => toggleSelected(row._row_key)}
                  onUpdate={(patch) => updateRow(row._row_key, patch)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="overflow-auto rounded-lg border border-[hsl(var(--border))]" style={tableStyle}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r._row_key)} strategy={verticalListSortingStrategy}>
              <table className="w-full min-w-max border-collapse text-left text-[12px]">
                <thead className={cn(cfg.stickyHeader !== false && 'sticky top-0 z-10')}>
                  <tr className="bg-[hsl(var(--muted))]/60 text-[hsl(var(--muted-foreground))]">
                    {canReorder && <th className="w-6 border-b border-[hsl(var(--border))] px-1" />}
                    {canSelect && (
                      <th className="w-6 border-b border-[hsl(var(--border))] px-2">
                        <Checkbox
                          checked={rows.length > 0 && selected.size === rows.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all rows"
                        />
                      </th>
                    )}
                    {columns.map((c) => (
                      <th
                        key={c.id}
                        className="relative border-b border-[hsl(var(--border))] px-2.5 py-2 font-medium"
                        style={colWidths[c.id] ? { width: colWidths[c.id], maxWidth: colWidths[c.id] } : undefined}
                      >
                        <span className="block truncate">
                          {c.label}
                          {c.component !== 'line_items' && c.behavior.required === 'always' && <span className="ml-0.5 text-[hsl(var(--destructive))]">*</span>}
                        </span>
                        {canResize && <ColumnResizeHandle colId={c.id} currentWidth={colWidths[c.id]} onResize={resizeColumn} />}
                      </th>
                    ))}
                    <th className="w-[104px] border-b border-[hsl(var(--border))] px-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <SummaryRow
                      key={row._row_key}
                      row={row}
                      columns={columns}
                      colWidths={colWidths}
                      canReorder={canReorder}
                      canDelete={canDelete}
                      canDuplicate={canDuplicate}
                      canSelect={canSelect}
                      isSelected={selected.has(row._row_key)}
                      atMin={atMin}
                      atMax={atMax}
                      rowPad={rowPad}
                      alternate={cfg.alternateRowColors !== false && i % 2 === 1}
                      isInline={cfg.rowEditMode === 'inline'}
                      disabled={disabled}
                      onEdit={() => openRow(row)}
                      onDelete={() => deleteRow(row._row_key)}
                      onDuplicate={() => duplicateRow(row._row_key)}
                      onToggleSelected={() => toggleSelected(row._row_key)}
                      onUpdate={(patch) => updateRow(row._row_key, patch)}
                    />
                  ))}
                </tbody>
                {showFooter && (
                  <tfoot>
                    <tr className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 font-medium text-[hsl(var(--foreground))]">
                      {canReorder && <td className="px-1" />}
                      {canSelect && <td className="px-2" />}
                      {columns.map((c) => (
                        <td key={c.id} className="px-2.5 py-2">
                          {summableCols.includes(c) ? formatValue(sumColumn(rows, c.key)) : null}
                        </td>
                      ))}
                      <td className="px-1" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {(canAdd || cfg.maxRows !== undefined) && (
        <div className="flex items-center justify-between">
          {canAdd ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              disabled={atMax}
              className="gap-1.5 border-dashed text-[hsl(var(--muted-foreground))]"
            >
              <Plus size={13} /> Add Row
            </Button>
          ) : <div />}
          {cfg.maxRows !== undefined && (
            <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">{allRows.length} / {cfg.maxRows} rows</p>
          )}
        </div>
      )}

      {editingRow && (
        <RowEditorSidebar
          row={editingRow}
          sections={sections}
          disabled={sidebarDisabled}
          isDraft={editingIsDraft}
          parentFormId={effectiveFormId}
          onChange={(patch) => updateRow(editingRow._row_key, patch)}
          onConfirm={() => { if (editingIsDraft) commitDraftRow(); setEditingRowKey(null) }}
          onDiscard={() => { if (editingIsDraft) discardDraftRow(); setEditingRowKey(null) }}
        />
      )}

      {viewingRowId && adoptedFormRef && adoptedForm && (
        <RowDetailDrawer
          formId={adoptedFormRef}
          recordId={viewingRowId}
          fields={adoptedForm.fields}
          layout={adoptedForm.layout}
          onClose={() => setViewingRowId(null)}
        />
      )}
    </div>
  )
}

/** Shared empty/zero-result state — used for "no columns configured" (a
 *  builder misconfiguration), "no rows yet" (genuinely empty, teaches the
 *  primary action), and "no matching rows" (a search with zero hits). Same
 *  shape throughout the grid rather than three different ad-hoc divs. */
function EmptyPanel({ icon: Icon, title, hint, action }: {
  icon: typeof PackageOpen
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] px-4 py-8 text-center">
      <Icon size={22} className="text-[hsl(var(--muted-foreground))]/60" strokeWidth={1.5} />
      <div className="space-y-0.5">
        <p className="text-[12.5px] font-medium text-[hsl(var(--foreground))]">{title}</p>
        <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">{hint}</p>
      </div>
      {action && (
        <Button type="button" variant="outline" size="sm" onClick={action.onClick} className="mt-1 gap-1.5">
          <Plus size={13} /> {action.label}
        </Button>
      )}
    </div>
  )
}

/** A draggable handle on a `<th>`'s trailing edge that reports live width
 *  deltas to the parent's colWidths map. Pointer events (not native HTML5
 *  drag) so the resize tracks continuously and works the same on touch. */
function ColumnResizeHandle({ colId, currentWidth, onResize }: {
  colId: string
  currentWidth: number | undefined
  onResize: (colId: string, width: number) => void
}) {
  const startRef = useRef<{ x: number; width: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.closest('th')
    const width = currentWidth ?? th?.getBoundingClientRect().width ?? 120
    startRef.current = { x: e.clientX, width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return
    onResize(colId, startRef.current.width + (e.clientX - startRef.current.x))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    startRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="group absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none items-center justify-center"
    >
      <div className="h-1/2 w-px bg-[hsl(var(--border))] transition-colors group-hover:bg-[hsl(var(--primary))] group-active:bg-[hsl(var(--primary))]" />
    </div>
  )
}

interface SummaryRowProps {
  row: Row
  columns: FormElement[]
  colWidths?: Record<string, number>
  canReorder: boolean
  canDelete: boolean
  canDuplicate: boolean
  canSelect: boolean
  isSelected: boolean
  atMin: boolean
  atMax: boolean
  rowPad: string
  alternate: boolean
  isInline: boolean
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleSelected: () => void
  onUpdate: (patch: FormRecord) => void
}

/** One preview row in the grid. In sidebar mode (isInline false — the
 *  original, only-ever-existed behavior), clicking anywhere on the row opens
 *  RowEditorSidebar with the full editable fields; cells only ever show
 *  formatted read-only values. In inline mode, each cell renders a live
 *  RowFieldInput instead and the row itself is no longer click-to-open
 *  (clicking would fight with clicking into an input) — EXCEPT a column that
 *  is itself a nested Line Items grid, which can never render inside a table
 *  cell and always falls back to a clickable "open in sidebar" cell
 *  regardless of isInline. Row actions (edit/duplicate/delete/drag) stay at
 *  opacity-0 until the row is hovered/focused-within — keeps a dense grid
 *  visually quiet at rest without hiding the affordance from keyboard/touch
 *  users, who always get it via :focus-within. */
function SummaryRow({ row, columns, colWidths, canReorder, canDelete, canDuplicate, canSelect, isSelected, atMin, atMax, rowPad, alternate, isInline, disabled, onEdit, onDelete, onDuplicate, onToggleSelected, onUpdate }: SummaryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row._row_key })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/row border-b border-[hsl(var(--border))] transition-colors last:border-b-0',
        !isInline && 'cursor-pointer hover:bg-[hsl(var(--accent))]/60',
        alternate && 'bg-[hsl(var(--muted))]/30',
        isDragging && 'opacity-60 shadow-sm',
        isSelected && 'bg-[hsl(var(--primary))]/[0.07] hover:bg-[hsl(var(--primary))]/10',
      )}
      onClick={isInline ? undefined : onEdit}
    >
      {canReorder && (
        <td className="px-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder row"
            title="Drag to reorder"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))]/50 opacity-0 transition-opacity hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--muted-foreground))] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] active:cursor-grabbing group-hover/row:opacity-100 group-focus-within/row:opacity-100"
          >
            <GripVertical size={13} />
          </button>
        </td>
      )}
      {canSelect && (
        <td className="px-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelected} aria-label="Select row" />
        </td>
      )}
      {columns.map((c) => (
        <td
          key={c.id}
          className={cn('px-2.5 text-[hsl(var(--foreground))]', rowPad)}
          style={colWidths?.[c.id] ? { width: colWidths[c.id], maxWidth: colWidths[c.id] } : undefined}
          onClick={isInline && c.component !== 'line_items' ? (e) => e.stopPropagation() : undefined}
        >
          {c.component === 'line_items' ? (
            <button type="button" onClick={onEdit} className="rounded text-[hsl(var(--muted-foreground))] underline-offset-2 transition-colors hover:text-[hsl(var(--primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
              {(Array.isArray(row[c.key]) ? (row[c.key] as unknown[]).length : 0)} row(s)
            </button>
          ) : isInline ? (
            <RowFieldInput column={c} value={row[c.key]} disabled={disabled} onChange={(v) => onUpdate({ [c.key]: v })} />
          ) : c.component === 'form' ? (
            <span className="block truncate"><ReferenceValueLabel formId={c.formRef} recordId={row[c.key]} displayField={c.displayField} /></span>
          ) : (
            <span className="block truncate">{formatValue(row[c.key])}</span>
          )}
        </td>
      ))}
      <td className="px-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[:focus-visible]:opacity-100">
          <button type="button" onClick={onEdit} aria-label="Edit row" title="Edit row" className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
            <Pencil size={12} />
          </button>
          {canDuplicate && (
            <button type="button" onClick={onDuplicate} disabled={atMax} aria-label="Duplicate row" title="Duplicate row" className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-30">
              <Copy size={12} />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={atMin} aria-label="Delete row" title="Delete row" className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-30">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

/** Cards-mode counterpart to SummaryRow — same fields/actions, laid out as a
 *  self-contained bordered card (label above value, stacked) instead of
 *  table cells, for narrow viewports or grids with too many columns to
 *  usefully show side by side. Column labels are shown here (a table's
 *  header row has nowhere to go in a card layout), unlike SummaryRow's cells
 *  which rely on the shared <thead>. */
function CardRow({ row, columns, canReorder, canDelete, canDuplicate, canSelect, isSelected, atMin, atMax, isInline, disabled, onEdit, onDelete, onDuplicate, onToggleSelected, onUpdate }: Omit<SummaryRowProps, 'rowPad' | 'alternate' | 'colWidths'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row._row_key })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/row rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-sm transition-all hover:border-[hsl(var(--primary))]/40 hover:shadow-md',
        !isInline && 'cursor-pointer',
        isDragging && 'opacity-60 shadow-lg',
        isSelected && 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/[0.06]',
      )}
      onClick={isInline ? undefined : onEdit}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canReorder && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder card"
              title="Drag to reorder"
              className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))]/50 transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] active:cursor-grabbing"
            >
              <GripVertical size={13} />
            </button>
          )}
          {canSelect && <Checkbox checked={isSelected} onCheckedChange={onToggleSelected} aria-label="Select card" />}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onEdit} aria-label="Edit row" title="Edit row" className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
            <Pencil size={12} />
          </button>
          {canDuplicate && (
            <button type="button" onClick={onDuplicate} disabled={atMax} aria-label="Duplicate row" title="Duplicate row" className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-30">
              <Copy size={12} />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={onDelete} disabled={atMin} aria-label="Delete row" title="Delete row" className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-30">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      <dl className={cn('grid gap-x-3 gap-y-1.5 text-[12px]', isInline ? 'grid-cols-1' : 'grid-cols-2')}>
        {columns.map((c) => (
          <div key={c.id} className="min-w-0" onClick={isInline && c.component !== 'line_items' ? (e) => e.stopPropagation() : undefined}>
            <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{c.label}</dt>
            <dd className={cn(!isInline && 'truncate', 'text-[hsl(var(--foreground))]')}>
              {c.component === 'line_items' ? (
                <button type="button" onClick={onEdit} className="rounded text-[hsl(var(--muted-foreground))] underline-offset-2 transition-colors hover:text-[hsl(var(--primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]">
                  {(Array.isArray(row[c.key]) ? (row[c.key] as unknown[]).length : 0)} row(s)
                </button>
              ) : isInline ? (
                <RowFieldInput column={c} value={row[c.key]} disabled={disabled} onChange={(v) => onUpdate({ [c.key]: v })} />
              ) : c.component === 'form' ? (
                <ReferenceValueLabel formId={c.formRef} recordId={row[c.key]} displayField={c.displayField} />
              ) : (
                formatValue(row[c.key])
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row editor sidebar
// ---------------------------------------------------------------------------

interface RowEditorSidebarProps {
  row: Row
  sections: LineItemSection[]
  disabled: boolean
  /** True while row is a not-yet-committed draft (opened via "+ Add Row",
   *  not yet confirmed) — see LineItemsGridInner's draftRow. Existing rows
   *  are always live in the grid already, so this is always false for them. */
  isDraft: boolean
  /** Passed through to a nested 'line_items' element inside this row — see
   *  RowFieldInput's doc comment. */
  parentFormId?: string
  onChange: (patch: FormRecord) => void
  /** "Done" — for a draft row this is what actually adds it to the grid;
   *  for an existing row it's just closing (already-live edits stay). */
  onConfirm: () => void
  /** Any other way of leaving (X button, Escape, overlay click) — discards
   *  an in-progress draft row instead of adding it. A no-op for an existing
   *  row, since there's nothing to discard (its edits are already live). */
  onDiscard: () => void
}

/** Full editable view of one Line Items row, in a slide-over sidebar rather
 *  than inline table cells. Fields lay out in the SAME sections/columns
 *  arrangement authored on the child form in LineItemsColumnsEditor —
 *  mirrors how FormRenderer lays out a normal form's sections/columns,
 *  instead of always stacking one field per row. A 'line_items' field
 *  renders as a nested LineItemsGrid; opening one of its own rows stacks
 *  another Drawer on top (each Drawer is an independent Radix root/portal,
 *  so they layer naturally without any manual z-index bookkeeping here). */
function RowEditorSidebar({ row, sections, disabled, isDraft, parentFormId, onChange, onConfirm, onDiscard }: RowEditorSidebarProps) {
  // 'runtime-root' only exists in the end-user-facing runtime shell (Add
  // menu, record detail drawer, etc.) — LineItemsGrid also renders inside
  // the admin's own record CRUD page (FormRecordsPage), which has no such
  // element. Falling back to document.body (Radix's own default) rather
  // than hardcoding 'runtime-root' means the drawer still portals correctly
  // there instead of silently rendering into a null container.
  const container = document.getElementById('runtime-root') ?? document.body

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onDiscard() }}>
      <DrawerContent size="md" container={container}>
        <DrawerHeader>
          <DrawerTitle>{isDraft ? 'New Row' : 'Edit Row'}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {sections.map((section) => (
            <div key={section.id}>
              {section.title && <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">{section.title}</h3>}
              {section.description && <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">{section.description}</p>}
              <div className="flex gap-4">
                {section.columns.map((col) => (
                  <RowEditorColumn
                    key={col.id}
                    column={col}
                    ratio={COLUMN_LAYOUTS[section.layout]?.ratios[section.columns.indexOf(col)] ?? 1}
                    row={row}
                    disabled={disabled}
                    parentFormId={parentFormId}
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <DrawerFooter>
          {isDraft && <Button type="button" variant="outline" size="sm" onClick={onDiscard}>Cancel</Button>}
          <Button type="button" size="sm" onClick={onConfirm}>{isDraft ? 'Add Row' : 'Done'}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

/** An existing adopted Line Items row opens as a REAL record detail — same
 *  Details/Audit Log/Linked Records tabs, same permission-gated Edit/Delete,
 *  same audit trail as any top-level record — instead of the lightweight
 *  RowEditorSidebar, since it genuinely is one. Mirrors RecordsTable.tsx's
 *  own Drawer+RecordDetailPanel pairing exactly, minus the "Expand to full
 *  page" button (there's no dedicated route for a row nested this deep, and
 *  the drawer already shows everything a full page would). Deleting the row
 *  here closes the drawer via onDeleted — the outer grid's own list re-fetches
 *  independently (RecordDetailPanel's delete mutation invalidates that
 *  form's query cache), so no explicit refresh call is needed here. */
// Lazy + a default-export adapter, specifically to break a real circular
// import: RecordDetailPanel.tsx imports LineItemsGrid (its own read-only
// Details-tab rendering of an adopted grid, and transitively via
// FormRenderer -> FieldRenderer -> LineItemsGrid for its edit-mode
// rendering) — a static top-level `import { RecordDetailPanel } from
// './RecordDetailPanel'` here closes that cycle the other direction, which
// left `useUpdateRecord` (and everything else LineItemsGrid.tsx imports)
// in a temporal-dead-zone at module-evaluation time whichever module
// happened to load first (confirmed live: "ReferenceError: useUpdateRecord
// is not defined" thrown from inside LineItemsGrid). Deferring the import
// until first render (well after both modules have finished evaluating)
// sidesteps the ordering problem entirely.
const LazyRecordDetailPanel = lazy(() =>
  import('./RecordDetailPanel').then((m) => ({ default: m.RecordDetailPanel })),
)

function RowDetailDrawer({ formId, recordId, fields, layout, onClose }: {
  formId: string
  recordId: string
  fields: FieldDef[]
  layout: unknown
  onClose: () => void
}) {
  const container = document.getElementById('runtime-root') ?? document.body
  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent size="lg" container={container}>
        <DrawerHeader>
          <DrawerTitle>Record details</DrawerTitle>
        </DrawerHeader>
        <Suspense fallback={<div className="flex-1 p-6"><Skeleton className="h-40 w-full" /></div>}>
          <LazyRecordDetailPanel
            formId={formId}
            recordId={recordId}
            fields={fields}
            schema={parseLayout(layout)}
            onDeleted={onClose}
          />
        </Suspense>
      </DrawerContent>
    </Drawer>
  )
}

function RowEditorColumn({ column, ratio, row, disabled, parentFormId, onChange }: {
  column: FormColumn
  ratio: number
  row: Row
  disabled: boolean
  /** Passed straight through to a nested 'line_items' element — see
   *  RowFieldInput's doc comment on why a nested grid falls back to the
   *  OUTER grid's own effectiveFormId rather than resolving its own. */
  parentFormId?: string
  onChange: (patch: FormRecord) => void
}) {
  return (
    <div className="space-y-4" style={{ flex: ratio }}>
      {column.elements.map((el) => (
        <div key={el.id}>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {el.label}
            {el.component !== 'line_items' && el.behavior.required === 'always' && <span className="ml-0.5 text-[hsl(var(--destructive))]">*</span>}
          </label>
          <RowFieldInput
            column={el}
            value={row[el.key]}
            disabled={disabled}
            parentFormId={parentFormId}
            onChange={(v) => onChange({ [el.key]: v })}
          />
        </div>
      ))}
    </div>
  )
}

function RowFieldInput({ column, value, disabled, parentFormId, onChange }: {
  column: FormElement
  value: unknown
  disabled: boolean
  /** A nested 'line_items' element (a Line Items grid whose OWN row also has
   *  a Line Items field) has no independent form id of its own to resolve
   *  permissions against here — a generated child form's own id was never
   *  fetched to the frontend at all (the builder schema only carries its
   *  authored lineItemColumns, not the generated form's real id). It falls
   *  back to the enclosing grid's own effectiveFormId instead, which is
   *  exactly the same fallback chain LineItemsGrid already uses for a
   *  generated (non-adopted) row's permission checks. */
  parentFormId?: string
  onChange: (v: unknown) => void
}) {
  switch (column.component) {
    case 'line_items':
      return <LineItemsGrid el={column} field={{ value, onChange }} parentFormId={parentFormId} disabled={disabled} />
    case 'textarea':
    case 'richtext':
      return <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'number':
      return (
        <Input
          type="number"
          value={(value as number | string) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
        />
      )
    case 'checkbox':
    case 'switch':
      return <Checkbox checked={!!value} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
    case 'date':
      return <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'time':
      return <Input type="time" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'datetime':
      return <Input type="datetime-local" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    case 'select':
    case 'radio':
      return (
        <Select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">—</option>
          {(column.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )
    case 'multiselect': {
      const values = Array.isArray(value) ? (value as string[]) : []
      const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
      return (
        <div className="space-y-1 rounded-md border border-[hsl(var(--border))] p-2">
          {(column.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
              <Checkbox checked={values.includes(o.value)} onCheckedChange={() => toggle(o.value)} disabled={disabled} />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    case 'form':
      return <ReferenceFieldInput column={column} value={value as string} disabled={disabled} onChange={onChange} />
    default:
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  }
}

// A searchable reference field — same server-side search/debounce/display
// heuristic as ReferenceFieldAutocomplete, sized for the sidebar's full-width
// field list rather than a compact table cell.
function ReferenceFieldInput({ column, value, disabled, onChange }: {
  column: FormElement
  value: string | undefined
  disabled: boolean
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: targetForm } = useFormDef(column.formRef ?? '')
  const searchField = useMemo(() => {
    if (column.displayField) return column.displayField
    if (!targetForm) return null
    const hasName = targetForm.fields.some((f) => f.name === 'name')
    const hasLabel = targetForm.fields.some((f) => f.name === 'label')
    return hasName ? 'name' : hasLabel ? 'label' : null
  }, [column.displayField, targetForm])

  const { data: results, isLoading } = useQuery({
    queryKey: ['forms', column.formRef, 'reference-options', debouncedSearch],
    queryFn: () =>
      formsApi.searchRecords(column.formRef!, {
        filter: searchField
          ? ({ combinator: 'and', conditions: [{ id: 'search', field: searchField, op: 'contains', value_mode: 'static', value: debouncedSearch }], groups: [] } as FilterGroup)
          : undefined,
        sort: [],
        page: 1,
        page_size: 20,
      }),
    enabled: !!column.formRef && open,
  })

  const { data: currentRecord } = useQuery({
    queryKey: ['forms', column.formRef, 'records', value],
    queryFn: () => formsApi.getRecord(column.formRef!, value!),
    enabled: !!column.formRef && !!value,
  })

  if (!column.formRef) return <span className="text-[11px] text-[hsl(var(--destructive))]">No form configured</span>

  const options = results?.records ?? []
  const displayOf = (r: FormRecord) => resolveReferenceLabel(targetForm?.fields, r, column.displayField)
  const selectedLabel = currentRecord ? displayOf(currentRecord) : value || undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('h-9 w-full justify-between gap-2 px-3 font-normal', !value && 'text-[hsl(var(--muted-foreground))]')}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="truncate">{selectedLabel ?? 'Search…'}</span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type to search…" value={search} onValueChange={setSearch} />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-[hsl(var(--muted-foreground))]">
                <Loader2 size={12} className="animate-spin" /> Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No records found.</CommandEmpty>
                <CommandGroup>
                  {options.map((r) => {
                    const id = r.id as string
                    return (
                      <CommandItem key={id} value={id} onSelect={() => { onChange(id === value ? '' : id); setOpen(false) }}>
                        <Check size={13} className={cn('shrink-0', id === value ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                        <span className="truncate">{displayOf(r)}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
