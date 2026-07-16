import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Filter as FilterIcon, Plus, Maximize2 } from 'lucide-react'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ActiveFiltersBar } from '@/components/ui/active-filters-bar'
import { PermissionGate } from '@/features/auth/PermissionGate'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { RecordDetailPanel } from '@/features/forms/runtime/RecordDetailPanel'
import { parseLayout } from '@/features/form-builder/serialize'
import type { MenuRuntimeRendererProps } from '../menu-registry'
import type { SearchMenuConfig, AddMenuConfig } from '../types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { FormRecord } from '@/features/forms/types'

export function SearchMenuRuntime({ menu, menus, onNavigate }: MenuRuntimeRendererProps) {
  const config = menu.config as SearchMenuConfig
  const { data: form } = useFormDef(config.form_id)

  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortRule[]>(
    (config.default_sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() })),
  )
  const [filter, setFilter] = useState<FilterGroup>(config.default_filter ?? newGroup())
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<FormRecord | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  const pageSize = config.page_size || 25

  const { data: results, isLoading } = useQuery({
    queryKey: ['forms', config.form_id, 'search', filter, sort, page, pageSize],
    queryFn: () => formsApi.searchRecords(config.form_id, { filter, sort, page, page_size: pageSize }),
    enabled: !!config.form_id,
  })

  if (!form) return null

  const visibleColumns = config.columns.length > 0 ? config.columns : form.fields.map((f) => f.name)
  const columns = visibleColumns.map((key) => {
    const field = form.fields.find((f) => f.name === key)
    return { key, label: field?.label ?? key, sortable: true }
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

  const addMenu = menus?.find((m) => m.menu_type === 'add' && (m.config as AddMenuConfig).form_id === config.form_id)

  const openRecord = (r: FormRecord) => {
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
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{menu.name}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilterOpen((o) => !o)} className="gap-1.5">
            <FilterIcon size={14} />Filter
          </Button>
          <PermissionGate need={`forms:${config.form_id}:create`}>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!addMenu}
              title={addMenu ? undefined : 'No Add page is configured for this form'}
              onClick={() => addMenu && onNavigate?.(addMenu.slug)}
            >
              <Plus size={14} />Create Record
            </Button>
          </PermissionGate>
        </div>
      </div>

      <ActiveFiltersBar filter={filter} fields={form.fields} onRemoveCondition={removeTopLevelCondition} onResetAll={resetFilter} />

      {filterOpen && (
        <div className="mb-4">
          <FilterBuilder
            group={filter}
            fields={form.fields}
            variables={[]}
            onChange={(g) => { setFilter(g); setPage(1) }}
          />
        </div>
      )}

      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
        <DataTable
          columns={columns}
          rows={results?.records ?? []}
          getRowId={(r) => r.id as string}
          sortField={sort[0]?.field}
          sortDir={sort[0]?.dir as 'asc' | 'desc' | undefined}
          onSortChange={toggleSort}
          onRowClick={openRecord}
          loading={isLoading}
        />
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
            <DrawerTitle>Record details</DrawerTitle>
            {selectedRecord && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onNavigate?.(`${menu.slug}/${selectedRecord.id as string}`)}
              >
                <Maximize2 size={12} />Expand
              </Button>
            )}
          </DrawerHeader>
          {selectedRecord && (
            <RecordDetailPanel
              formId={config.form_id}
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
