// One Kanban column's own independent, infinitely-scrollable record query —
// see KanbanLayout.tsx's top-of-file comment for why Kanban can't reuse
// RecordsTable's single flat `results` page the way List/Card/Calendar do.
import { useInfiniteQuery } from '@tanstack/react-query'
import { formsApi } from '@/features/forms/api'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

const COLUMN_PAGE_SIZE = 25

/** AND's the view's own filter with `groupField = value` — the column's
 *  slice of the same overall result set every other layout shows, scoped to
 *  one enum value. Reuses the backend's ordinary `eq` filter condition
 *  (buildWhere/buildCondition), no new filter machinery needed. */
function withColumnFilter(base: FilterGroup, groupField: string, value: string): FilterGroup {
  const columnCond = { id: `kanban-col-${groupField}`, field: groupField, op: 'eq' as const, value_mode: 'static' as const, value }
  if (!base.conditions.length && !base.groups.length) {
    return { combinator: 'and', conditions: [columnCond], groups: [] }
  }
  return { combinator: 'and', conditions: [columnCond], groups: [base] }
}

/** kanban_order first (the column's own drag-persisted position — NULLs
 *  sort last server-side), then whatever the view's own Sort rules are, so a
 *  never-dragged column still orders sensibly instead of by undefined
 *  database order. */
function withKanbanOrder(sort: SortRule[]): SortRule[] {
  return [{ id: 'kanban-order', field: 'kanban_order', dir: 'asc' }, ...sort]
}

export function useKanbanColumn(formId: string, baseFilter: FilterGroup, sort: SortRule[], groupField: string, columnValue: string, enabled: boolean) {
  const filter = withColumnFilter(baseFilter, groupField, columnValue)
  const orderedSort = withKanbanOrder(sort)

  const query = useInfiniteQuery({
    queryKey: ['forms', formId, 'kanban-column', groupField, columnValue, baseFilter, sort],
    queryFn: ({ pageParam }) =>
      formsApi.searchRecords(formId, { filter, sort: orderedSort, page: pageParam, page_size: COLUMN_PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => (lastPage.records.length < COLUMN_PAGE_SIZE ? undefined : allPages.length + 1),
    initialPageParam: 1,
    enabled,
  })

  const records = query.data?.pages.flatMap((p) => p.records) ?? []
  const total = query.data?.pages[0]?.total ?? 0

  return { records, total, ...query }
}
