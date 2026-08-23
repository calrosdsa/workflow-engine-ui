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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ActiveFiltersBar } from '@/components/ui/active-filters-bar'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { RecordDetailPanel, RecordDetailToolbar } from './RecordDetailPanel'
import { resolveRecordTitle } from './record-title'
import { formatSystemDatetime } from './format-value'
import { RecordReferenceLink } from './RecordReferenceLink'
import { RoleValueLabel } from './RoleValueLabel'
import { buildEnumLabels, resolveEnumLabel } from './enum-labels'
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
  /** Lets the viewer drag-reorder the List layout's columns AND (once
   *  Kanban's own onColumnOrderChange fires) the Kanban board's columns —
   *  omitted (no drag handles on either layout, unchanged behavior) unless
   *  the caller is rendering a saved view that supports persisting layout
   *  changes. Distinct from onLiveConfigChange below: this flag only
   *  controls whether drag HANDLES render at all; onLiveConfigChange is
   *  what actually receives the resulting change once a drag (or any other
   *  live edit — filter, sort, List's Columns picker) happens. */
  columnDragEnabled?: boolean
  /** Fired on every live change to this table's own filter/sort/columns/
   *  layoutConfig state — a saved-view-driven caller (SearchMenuRuntime)
   *  uses this to detect "the live table no longer matches the active
   *  view's saved config" and show an unsaved-changes prompt, rather than
   *  any of these changes auto-persisting on their own (this used to be
   *  onColumnsReorder's job for List's own column drag specifically, firing
   *  straight into an instant, silent auto-save with no prompt — folded
   *  into this single, consistent mechanism instead, covering every kind of
   *  live change the same way). Omitted for callers that don't track a
   *  saved view at all (the dashboard table widget), which simply never
   *  offers a way to persist a live change back anywhere. */
  onLiveConfigChange?: (patch: { columns?: string[]; filter?: FilterGroup; sort?: SortRule[]; layoutConfig?: CalendarLayoutConfig | KanbanLayoutConfig }) => void
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
  formId, columns: columnsProp, defaultFilter, defaultSort, pageSize: pageSizeProp,
  allowFilter = false, allowSearch = false, rowClick = true, headerActions, onExpandRecord, title,
  layout = 'list', layoutConfig: layoutConfigProp, columnDragEnabled = false, onLiveConfigChange,
}: RecordsTableProps) {
  const { data: form, isLoading: isFormLoading, isError: isFormError } = useFormDef(formId)

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortRule[]>(
    (defaultSort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() })),
  )
  const [filter, setFilter] = useState<FilterGroup>(defaultFilter ?? newGroup())
  // columns was a plain pass-through prop until Kanban/List's column
  // drag-reorder needed something to mutate — now local state (seeded once
  // from the prop, same convention filter/sort already use), so a drag
  // updates what's rendered immediately, with onLiveConfigChange (below)
  // telling the caller a live edit happened for its own unsaved-changes
  // tracking. layoutConfig has no such mutator right now (Kanban's own
  // column drag-reorder is disabled — see that KanbanLayout call site's own
  // comment), so it stays a plain destructured prop rather than state that
  // nothing ever sets; re-promote it to useState alongside a restored
  // applyLayoutConfig if live column drag comes back.
  const [columns, setColumns] = useState<string[] | undefined>(columnsProp)
  const layoutConfig = layoutConfigProp
  const [filterOpen, setFilterOpen] = useState(false)
  // The filter popover edits a local draft, not `filter` directly — every
  // FilterBuilder edit used to call applyFilter (and therefore re-run the
  // search query) on every keystroke/selection, which also meant a change
  // was already live even if the viewer closed the popover by clicking
  // away without ever meaning to commit it. draftFilter is seeded from the
  // real `filter` each time the popover opens (not on every render — see
  // handleFilterOpenChange below) and only reaches applyFilter when Apply
  // is clicked; Cancel/click-outside/Escape just closes the popover with
  // the draft discarded.
  const [draftFilter, setDraftFilter] = useState<FilterGroup>(filter)
  const handleFilterOpenChange = (open: boolean) => {
    if (open) setDraftFilter(filter)
    setFilterOpen(open)
  }
  const applyDraftFilter = () => {
    applyFilter(draftFilter)
    setPage(1)
    setFilterOpen(false)
  }
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

  // Kanban owns its own per-column queries entirely (KanbanLayout/
  // useKanbanColumn — see that file's top comment for why a flat page/
  // pageSize over the WHOLE result set can't express "the next page of just
  // one column"), so this shared List/Card/Calendar query would be pure
  // waste when Kanban is active — disabled rather than fetched and ignored.
  const { data: results, isLoading, isError: isSearchError } = useQuery({
    queryKey: ['forms', formId, 'search', filter, sort, page, pageSize, canSearch ? query : ''],
    queryFn: () => formsApi.searchRecords(formId, { filter, sort, page, page_size: pageSize, query: (canSearch && query) || undefined }),
    enabled: !!formId && layout !== 'kanban',
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

  // A select/radio/multiselect field's real option LABELS ("Active") only
  // exist in the form's rich builder layout — FieldDef.enum_values is
  // deliberately value-only (form-builder/projection.ts's own comment: "the
  // CHECK constraint set"), so a read-only render of an enum value with
  // nothing else falls back to the raw stored string ("active"). Editing
  // already shows real labels (FieldRenderer.tsx reads el.options directly);
  // this recovers the same labels for List/Card's read-only display. Reuses
  // the same parseLayout(form.layout) call the record-detail drawer below
  // already makes, rather than a second, redundant parse.
  const formSchema = parseLayout(form.layout)
  const enumLabels = buildEnumLabels(formSchema)

  // §6's named edge case: a saved view's Calendar/Kanban layout_config names
  // a field that was later deleted/renamed on the form — falls back to List
  // with a visible notice rather than a broken/silent render (see below).
  const calendarFieldMissing = layout === 'calendar' && (!layoutConfig || !fieldsWithSystem.some((f) => f.name === (layoutConfig as CalendarLayoutConfig).dateField))
  // Kanban is enum-only ("just consider select fields" — see KanbanLayout's
  // top comment) — a view whose groupField was later changed to a
  // non-enum type, or removed entirely, falls back to List the same way a
  // deleted field already does, rather than rendering a broken board.
  const kanbanFieldMissing = layout === 'kanban' && (!layoutConfig || !form.fields.some((f) => f.name === (layoutConfig as KanbanLayoutConfig).groupField && f.type === 'enum'))
  const effectiveLayout: ViewLayout = layout === 'calendar' && calendarFieldMissing ? 'list' : layout === 'kanban' && kanbanFieldMissing ? 'list' : layout

  const visibleColumns = columns && columns.length > 0 ? columns : form.fields.map((f) => f.name)
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
    const isEnum = field?.type === 'enum'
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
        : isEnum
        ? (row: FormRecord) => resolveEnumLabel(enumLabels, key, row[key])
        : undefined,
    }
  })

  // Every one of these wraps the underlying setState call with an
  // onLiveConfigChange notification — the single mechanism SearchMenuRuntime
  // uses to detect "the live table no longer matches the active view's
  // saved config" and offer to save it (see onLiveConfigChange's own doc
  // comment for why this replaced the old onColumnsReorder auto-save).
  // No applyLayoutConfig here — its only caller was Kanban's column
  // drag-reorder, currently disabled (see the layoutConfig-setting KanbanLayout
  // call site's own comment); layoutConfig itself stays local state since
  // Calendar/Kanban's own config still needs to remount cleanly on
  // save/discard the same way filter/sort/columns do.
  const applySort = (next: SortRule[]) => {
    setSort(next)
    onLiveConfigChange?.({ sort: next })
  }
  const applyFilter = (next: FilterGroup) => {
    setFilter(next)
    // Keeps draftFilter from ever trailing behind a real commit that
    // happened from OUTSIDE the popover's own Apply button — the chip bar's
    // per-condition remove/Reset all buttons call this directly, and if the
    // popover happened to be open at the time with its own unsaved edits,
    // leaving draftFilter pointed at the pre-chip-removal state would mean
    // clicking Apply next resurrects a condition the chip bar just removed.
    setDraftFilter(next)
    onLiveConfigChange?.({ filter: next })
  }
  const applyColumns = (next: string[]) => {
    setColumns(next)
    onLiveConfigChange?.({ columns: next })
  }

  const toggleSort = (field: string) => {
    setPage(1)
    const existing = sort.find((s) => s.field === field)
    const next = !existing ? [{ id: nanoid(), field, dir: 'asc' as const }] : existing.dir === 'asc' ? [{ ...existing, dir: 'desc' as const }] : []
    applySort(next)
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
    applyFilter({ ...filter, conditions: filter.conditions.filter((_, i) => i !== index) })
    setPage(1)
  }
  const resetFilter = () => {
    applyFilter(newGroup())
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
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search…"
                  className="h-8 w-48 pl-7 text-sm"
                />
              </div>
            )}
            {allowFilter && (
              <Popover open={filterOpen} onOpenChange={handleFilterOpenChange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <FilterIcon size={14} />Filter
                  </Button>
                </PopoverTrigger>
                {/* Anchored to the Filter button, not a centered/backdropped
                   Dialog — a filter panel is a quick, in-context adjustment,
                   not something that needs to interrupt the whole page the
                   way a modal does. Wider than PopoverContent's own w-72
                   default (the Reference-value picker/date inputs need more
                   room than a typical popover menu), and its own scroll
                   area caps how tall the panel gets as conditions/groups are
                   added, rather than growing without bound. Nested groups
                   indent further right each level, so the inner content
                   also scrolls horizontally rather than clipping or
                   squeezing condition rows once they exceed the panel's
                   width. */}
                <PopoverContent
                  align="end"
                  className="w-[32rem] max-w-[calc(100vw-2rem)] p-0"
                  container={document.getElementById('runtime-root')}
                >
                  <div className="max-h-[70vh] overflow-y-auto overflow-x-auto p-3">
                    <FilterBuilder
                      group={draftFilter}
                      fields={fieldsWithSystem}
                      variables={[]}
                      onChange={setDraftFilter}
                      hideExpressions
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 border-t p-2" style={{ borderColor: 'hsl(var(--border))' }}>
                    <Button variant="ghost" size="sm" onClick={() => setFilterOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={applyDraftFilter}>Apply</Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {headerActions}
          </div>
        </div>
      )}

      {allowFilter && (
        <ActiveFiltersBar filter={filter} fields={fieldsWithSystem} onRemoveCondition={removeTopLevelCondition} onResetAll={resetFilter} />
      )}

      {calendarFieldMissing && layoutConfig && (
        <p className="mb-3 rounded-md border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/15 px-3 py-2 text-xs text-[hsl(var(--warning))]">
          This view's Calendar field no longer exists — showing as a list.
        </p>
      )}
      {kanbanFieldMissing && layoutConfig && (
        <p className="mb-3 rounded-md border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/15 px-3 py-2 text-xs text-[hsl(var(--warning))]">
          This view's Kanban field no longer exists — showing as a list.
        </p>
      )}

      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
        {effectiveLayout === 'card' && (
          <CardLayout records={results?.records ?? []} fields={fieldsWithSystem} columns={visibleColumns} roleField={form.create_user_role_field} enumLabels={enumLabels} onOpenRecord={openRecord} loading={isLoading} />
        )}
        {effectiveLayout === 'calendar' && (
          <CalendarLayout records={results?.records ?? []} fields={fieldsWithSystem} config={layoutConfig as CalendarLayoutConfig} onOpenRecord={openRecord} loading={isLoading} />
        )}
        {effectiveLayout === 'kanban' && (
          <KanbanLayout
            formId={formId}
            fields={form.fields}
            config={layoutConfig as KanbanLayoutConfig}
            filter={filter}
            sort={sort}
            columns={visibleColumns}
            roleField={form.create_user_role_field}
            enumLabels={enumLabels}
            onOpenRecord={openRecord}
            // Column drag-reorder is disabled for now (card drag between/
            // within columns stays on) — omitting onColumnOrderChange
            // entirely means KanbanLayout renders no grip handle at all,
            // same as before this prop existed. Column order/visibility is
            // still configurable through the Edit View drawer's own picker
            // (KanbanColumnsPicker); only the live-board drag affordance is
            // off. Re-enable by restoring the columnDragEnabled-gated
            // callback this replaced if/when live column drag comes back.
          />
        )}
        {effectiveLayout === 'list' && (
          <DataTable
            columns={dataTableColumns}
            rows={results?.records ?? []}
            getRowId={(r) => r.id as string}
            sortField={sort[0]?.field}
            sortDir={sort[0]?.dir as 'asc' | 'desc' | undefined}
            onSortChange={toggleSort}
            onRowDoubleClick={rowClick ? (onExpandRecord ?? openRecord) : undefined}
            loading={isLoading}
            emptyMessage={isSearchError ? "Couldn't load records — try again." : undefined}
            onColumnsReorder={columnDragEnabled ? applyColumns : undefined}
          />
        )}
      </div>

      {effectiveLayout !== 'kanban' && (
        // Kanban paginates per-column (each KanbanColumn's own infinite
        // scroll) rather than one flat page over the whole result set, so
        // this footer — driven by the now-disabled outer search query — has
        // nothing meaningful to show while it's active.
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
      )}

      <Drawer open={!!selectedRecord} onOpenChange={(o) => !o && closeRecord()}>
        <DrawerContent size="lg" container={document.getElementById('runtime-root')}>
          <DrawerHeader className="flex flex-row items-center justify-between gap-2 pr-10">
            <DrawerTitle className="truncate">
              {(selectedRecord && resolveRecordTitle(form.fields, selectedRecordLive ?? selectedRecord)) || 'Record details'}
            </DrawerTitle>
            <div className="flex shrink-0 items-center gap-1.5">
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
              {selectedRecord && (
                <RecordDetailToolbar
                  formId={formId}
                  recordId={selectedRecord.id as string}
                  record={selectedRecordLive ?? selectedRecord}
                  createUserSettings={formSchema.settings?.createUser}
                  schema={formSchema}
                  onDeleted={closeRecord}
                />
              )}
            </div>
          </DrawerHeader>
          {selectedRecord && (
            <RecordDetailPanel
              formId={formId}
              recordId={selectedRecord.id as string}
              fields={form.fields}
              schema={formSchema}
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
      <Icon size={18} className={cn(spin && 'animate-spin', tone === 'error' ? 'text-[hsl(var(--destructive))]/50' : 'text-[hsl(var(--muted-foreground))]/60')} />
      <p className={cn('text-xs', tone === 'error' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]')}>{text}</p>
    </div>
  )
}
