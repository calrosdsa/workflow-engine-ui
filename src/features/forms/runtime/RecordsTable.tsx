import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Filter as FilterIcon, Maximize2, Loader2, AlertCircle, Search } from 'lucide-react'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { cn } from '@/lib/utils'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ActiveFiltersBar } from '@/components/ui/active-filters-bar'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { RecordDetailPanel } from './RecordDetailPanel'
import { resolveRecordTitle } from './record-title'
import { formatSystemDatetime } from './format-value'
import { RecordReferenceLink } from './RecordReferenceLink'
import { RoleValueLabel } from './RoleValueLabel'
import { parseLayout } from '@/features/form-builder/serialize'
import { CardLayout } from '@/features/menus/saved-views/layouts/CardLayout'
import { CalendarLayout } from '@/features/menus/saved-views/layouts/CalendarLayout'
import { KanbanLayout } from '@/features/menus/saved-views/layouts/KanbanLayout'
import { SYSTEM_FIELDS } from '@/features/menus/saved-views/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { FormRecord } from '@/features/forms/types'
import type { ViewLayout, CalendarLayoutConfig, KanbanLayoutConfig } from '@/features/menus/saved-views/types'

export interface RecordsTableProps {
  formId: string
  /** Empty array/undefined means "all fields" — same convention
   *  SearchMenuConfig.columns already uses. */
  columns?: string[]
  defaultFilter?: FilterGroup
  defaultSort?: SortRule[]
  pageSize?: number
  /** Shows the Filter toggle + FilterBuilder/ActiveFiltersBar chrome above
   *  the table. Off by default for embedded/tile contexts (a dashboard
   *  table widget's tile is small; filtering is meant to be configured once
   *  by the dashboard's author, not re-filtered per viewer) — SearchMenuRuntime
   *  turns it on since that's its whole purpose as a dedicated search page. */
  allowFilter?: boolean
  /** Shows a free-text search box above the table that queries the form's
   *  combined full-text search column (fields marked searchable — see
   *  FieldDef.searchable). Off by default, same rationale as allowFilter:
   *  SearchMenuRuntime turns it on since that's its dedicated purpose;
   *  embedded/tile contexts (dashboard table widget) leave it off. Composes
   *  with allowFilter's FilterBuilder filter rather than replacing it. */
  allowSearch?: boolean
  /** Clicking a row opens the record-detail drawer. Off disables row click
   *  entirely (not just the drawer) — a dashboard tile that's meant to be a
   *  glanceable summary shouldn't invite a click that does nothing. */
  rowClick?: boolean
  /** Rendered top-right, alongside the Filter toggle — e.g. SearchMenuRuntime's
   *  "Create Record" button. Omitted entirely (not just hidden) by callers
   *  that don't need it, like the table widget. */
  headerActions?: React.ReactNode
  /** Called when the record-detail drawer's "Expand" button is clicked —
   *  SearchMenuRuntime navigates to a full record page; callers that have no
   *  such page (the table widget, at least until Data widgets get their own
   *  drill-down route) can omit this, which hides the Expand button. */
  onExpandRecord?: (record: FormRecord) => void
  /** Shows the menu title heading above the toolbar — SearchMenuRuntime's
   *  own "{menu.name}" heading. Omitted for tile contexts where the
   *  dashboard widget's own tile chrome already shows a title. */
  title?: string
  /** FR-D2-014: which presentation to render this same filtered/sorted
   *  record set as. Defaults to 'list' (today's DataTable, unchanged) for
   *  every existing caller that doesn't pass this. Card/Calendar/Kanban
   *  reuse the identical searchRecords query and record-detail drawer —
   *  only the results' presentation differs. */
  layout?: ViewLayout
  layoutConfig?: CalendarLayoutConfig | KanbanLayoutConfig
  /** Lets the viewer drag-reorder the List layout's columns — omitted (no
   *  drag handles, unchanged behavior) unless the caller is rendering a
   *  saved view that supports persisting column order (SearchMenuRuntime,
   *  once a saved view is active). */
  onColumnsReorder?: (newColumnKeys: string[]) => void
}

// Extracted from features/menus/runtime/SearchMenuRuntime.tsx (Phase 4 of
// docs/dashboard-system-plan.md — table widget wraps this rather than
// re-implementing it, so the Search menu and the dashboard's table widget
// can never drift into two different record-table behaviors). Owns:
// filter/sort/pagination state, the live formsApi.searchRecords query, the
// DataTable render, and the record-detail drawer. SearchMenuRuntime and the
// table widget both become thin callers supplying only what differs between
// them (title, header actions, filter UI toggle, expand navigation).
export function RecordsTable({
  formId, columns: columnKeys, defaultFilter, defaultSort, pageSize: pageSizeProp,
  allowFilter = false, allowSearch = false, rowClick = true, headerActions, onExpandRecord, title,
  layout = 'list', layoutConfig, onColumnsReorder,
}: RecordsTableProps) {
  const { data: form, isLoading: isFormLoading, isError: isFormError } = useFormDef(formId)

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortRule[]>(
    (defaultSort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() })),
  )
  const [filter, setFilter] = useState<FilterGroup>(defaultFilter ?? newGroup())
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<FormRecord | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  const pageSize = pageSizeProp || 25

  // A form with no field marked searchable has no "tsv" column on its table
  // (see FieldDef.searchable's doc comment) — sending a query against it
  // would fail server-side, so the search box only renders/queries when at
  // least one field opted in.
  const canSearch = allowSearch && !!form?.fields?.some((f) => f.searchable)

  // Debounce the search box so every keystroke doesn't fire a request —
  // 300ms matches the FilterBuilder/dashboard convention for live-typing
  // queries elsewhere in this codebase.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput])

  const { data: results, isLoading, isError: isSearchError } = useQuery({
    queryKey: ['forms', formId, 'search', filter, sort, page, pageSize, canSearch ? query : ''],
    queryFn: () => formsApi.searchRecords(formId, { filter, sort, page, page_size: pageSize, query: (canSearch && query) || undefined }),
    enabled: !!formId,
  })

  // selectedRecord is a point-in-time snapshot of the clicked table row, so
  // an in-drawer edit (RecordDetailPanel's own Edit button) updates the
  // record but never that snapshot — the drawer title would keep showing
  // the pre-edit title/id forever. Re-fetch the same record RecordDetailPanel
  // shows so the title tracks its live data too; the snapshot still backs
  // the title until this resolves, avoiding a flash back to "Record details".
  const { data: selectedRecordLive } = useQuery({
    queryKey: ['forms', formId, 'records', selectedRecord?.id],
    queryFn: () => formsApi.getRecord(formId, selectedRecord!.id as string),
    enabled: !!selectedRecord,
  })

  // Both the form definition and the search results are fetched
  // independently, so each gets its own guard — the form definition drives
  // column labels/field types the table can't render without, so it blocks
  // the whole tile; a search-results failure (below) is handled inline
  // once the form has loaded, since the surrounding chrome (title, filter
  // controls) is still meaningful to show even if this page's data failed.
  if (!formId) {
    return <RecordsTableMessage icon={AlertCircle} text="No form is selected." tone="muted" />
  }
  if (isFormLoading) {
    return <RecordsTableMessage icon={Loader2} text="Loading…" tone="muted" spin />
  }
  if (isFormError || !form) {
    return <RecordsTableMessage icon={AlertCircle} text="Couldn't load this form. It may have been deleted." tone="error" />
  }

  // Created At / Last Modified — every record already carries these two
  // audit columns (selectCols(), internal/forms/store/records.go), so
  // they're always pickable/sortable/displayable alongside the form's own
  // fields, without needing a backend change. Only affects lookups that
  // resolve a column KEY to its field metadata (label, type) — the
  // no-explicit-columns fallback below deliberately stays real-fields-only,
  // so a saved view with no columns picked doesn't silently gain two new
  // columns nobody asked for.
  const fieldsWithSystem = [...form.fields, ...SYSTEM_FIELDS]

  // §6's named edge case: a saved view's Calendar/Kanban layout_config names
  // a field that was later deleted/renamed on the form — falls back to List
  // with a visible notice rather than a broken/silent render (see below).
  const calendarFieldMissing = layout === 'calendar' && (!layoutConfig || !fieldsWithSystem.some((f) => f.name === (layoutConfig as CalendarLayoutConfig).dateField))
  const kanbanFieldMissing = layout === 'kanban' && (!layoutConfig || !form.fields.some((f) => f.name === (layoutConfig as KanbanLayoutConfig).groupField))
  const effectiveLayout: ViewLayout = layout === 'calendar' && calendarFieldMissing ? 'list' : layout === 'kanban' && kanbanFieldMissing ? 'list' : layout

  const visibleColumns = columnKeys && columnKeys.length > 0 ? columnKeys : form.fields.map((f) => f.name)
  const dataTableColumns = visibleColumns.map((key) => {
    const field = fieldsWithSystem.find((f) => f.name === key)
    const isReference = field?.type === 'reference'
    const isSystemDatetime = key === 'created_at' || key === 'updated_at'
    // The Account section's Role field (form-builder/factory.ts's
    // createAccountSection) stores a role ID as a plain string — no field
    // type distinguishes it from any other text field, so without this
    // check it renders the raw UUID instead of the role's name. Editing
    // already resolves it correctly (FieldRenderer.tsx's RoleFieldInput);
    // this is the read-only List-column counterpart.
    const isRoleField = key === form.create_user_role_field
    return {
      key,
      label: field?.label ?? key,
      sortable: true,
      render: isReference
        ? (row: FormRecord) => <RecordReferenceLink formId={field.reference_table} recordId={row[key]} displayField={field.display_field} />
        : isRoleField
        ? (row: FormRecord) => <RoleValueLabel roleId={row[key]} />
        : isSystemDatetime
        ? (row: FormRecord) => formatSystemDatetime(row[key])
        : undefined,
    }
  })

  const toggleSort = (field: string) => {
    setPage(1)
    setSort((prev) => {
      const existing = prev.find((s) => s.field === field)
      if (!existing) return [{ id: nanoid(), field, dir: 'asc' }]
      if (existing.dir === 'asc') return [{ ...existing, dir: 'desc' }]
      return []
    })
  }

  const total = results?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openRecord = (r: FormRecord) => {
    if (!rowClick) return
    savedScrollTop.current = scrollRef.current?.scrollTop ?? 0
    setSelectedRecord(r)
  }
  const closeRecord = () => {
    setSelectedRecord(null)
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop.current
    })
  }

  const removeTopLevelCondition = (index: number) => {
    setFilter((f) => ({ ...f, conditions: f.conditions.filter((_, i) => i !== index) }))
    setPage(1)
  }
  const resetFilter = () => {
    setFilter(newGroup())
    setPage(1)
  }

  return (
    <div>
      {(title || allowFilter || canSearch || headerActions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {title ? <h1 className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{title}</h1> : <div />}
          <div className="flex items-center gap-2">
            {canSearch && (
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search…"
                  className="h-8 w-48 pl-7 text-sm"
                />
              </div>
            )}
            {allowFilter && (
              <Button variant="outline" size="sm" onClick={() => setFilterOpen((o) => !o)} className="gap-1.5">
                <FilterIcon size={14} />Filter
              </Button>
            )}
            {headerActions}
          </div>
        </div>
      )}

      {allowFilter && (
        <>
          <ActiveFiltersBar filter={filter} fields={fieldsWithSystem} onRemoveCondition={removeTopLevelCondition} onResetAll={resetFilter} />
          {filterOpen && (
            <div className="mb-4">
              <FilterBuilder
                group={filter}
                fields={fieldsWithSystem}
                variables={[]}
                onChange={(g) => { setFilter(g); setPage(1) }}
              />
            </div>
          )}
        </>
      )}

      {calendarFieldMissing && layoutConfig && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This view's Calendar field no longer exists — showing as a list.
        </p>
      )}
      {kanbanFieldMissing && layoutConfig && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This view's Kanban field no longer exists — showing as a list.
        </p>
      )}

      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
        {effectiveLayout === 'card' && (
          <CardLayout records={results?.records ?? []} fields={fieldsWithSystem} columns={visibleColumns} roleField={form.create_user_role_field} onOpenRecord={openRecord} loading={isLoading} />
        )}
        {effectiveLayout === 'calendar' && (
          <CalendarLayout records={results?.records ?? []} fields={fieldsWithSystem} config={layoutConfig as CalendarLayoutConfig} onOpenRecord={openRecord} loading={isLoading} />
        )}
        {effectiveLayout === 'kanban' && (
          <KanbanLayout records={results?.records ?? []} fields={form.fields} config={layoutConfig as KanbanLayoutConfig} onOpenRecord={openRecord} loading={isLoading} />
        )}
        {effectiveLayout === 'list' && (
          <DataTable
            columns={dataTableColumns}
            rows={results?.records ?? []}
            getRowId={(r) => r.id as string}
            sortField={sort[0]?.field}
            sortDir={sort[0]?.dir as 'asc' | 'desc' | undefined}
            onSortChange={toggleSort}
            onRowClick={rowClick ? openRecord : undefined}
            loading={isLoading}
            emptyMessage={isSearchError ? "Couldn't load records — try again." : undefined}
            onColumnsReorder={onColumnsReorder}
          />
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between" style={{ color: 'hsl(var(--muted-foreground))' }}>
        <span>{total} record{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 gap-1 px-2">
            <ChevronLeft size={12} />Prev
          </Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 gap-1 px-2">
            Next<ChevronRight size={12} />
          </Button>
        </div>
      </div>

      <Drawer open={!!selectedRecord} onOpenChange={(o) => !o && closeRecord()}>
        <DrawerContent size="lg" container={document.getElementById('runtime-root')}>
          <DrawerHeader className="flex flex-row items-center justify-between pr-10">
            <DrawerTitle className="truncate">
              {(selectedRecord && resolveRecordTitle(form.fields, selectedRecordLive ?? selectedRecord)) || 'Record details'}
            </DrawerTitle>
            {selectedRecord && onExpandRecord && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onExpandRecord(selectedRecord)}
              >
                <Maximize2 size={12} />Expand
              </Button>
            )}
          </DrawerHeader>
          {selectedRecord && (
            <RecordDetailPanel
              formId={formId}
              recordId={selectedRecord.id as string}
              fields={form.fields}
              schema={parseLayout(form.layout)}
              onDeleted={closeRecord}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// Shared shape for RecordsTable's three "nothing to show yet" states (no
// form selected / form loading / form failed to load) — kept as one small
// component rather than three near-duplicate JSX blocks, since all three
// share the same layout and only the icon/text/tone differ.
function RecordsTableMessage({ icon: Icon, text, tone, spin }: {
  icon: typeof Loader2
  text: string
  tone: 'muted' | 'error'
  spin?: boolean
}) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 p-3 text-center">
      <Icon size={18} className={cn(spin && 'animate-spin', tone === 'error' ? 'text-red-300' : 'text-slate-300')} />
      <p className={cn('text-xs', tone === 'error' ? 'text-red-500' : 'text-slate-400')}>{text}</p>
    </div>
  )
}
