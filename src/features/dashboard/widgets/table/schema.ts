import type { FilterGroup, SortRule } from '@/features/workflows/types'

export type TableRowClick = 'none' | 'record'

export interface TableWidgetConfig {
  formId: string
  columns: string[]
  defaultFilter?: FilterGroup
  defaultSort?: SortRule[]
  /** Dashboard-tile-appropriate default (10) — much smaller than the Search
   *  menu's own default (25), matching docs/dashboard-system-plan.md
   *  section 5.4: a tile is a glanceable summary, not a full search page. */
  pageSize: number
  allowUserFilter: boolean
  rowClick: TableRowClick
}

const VALID_ROW_CLICK: TableRowClick[] = ['none', 'record']

export function parseTableConfig(raw: unknown): TableWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<TableWidgetConfig>
    if (typeof r.formId === 'string') {
      return {
        formId: r.formId,
        columns: Array.isArray(r.columns) ? r.columns.filter((c): c is string => typeof c === 'string') : [],
        defaultFilter: r.defaultFilter,
        defaultSort: Array.isArray(r.defaultSort) ? r.defaultSort : undefined,
        pageSize: typeof r.pageSize === 'number' && r.pageSize > 0 ? r.pageSize : 10,
        allowUserFilter: r.allowUserFilter === true,
        rowClick: r.rowClick && VALID_ROW_CLICK.includes(r.rowClick) ? r.rowClick : 'record',
      }
    }
  }
  return createDefaultTableConfig()
}

export function createDefaultTableConfig(): TableWidgetConfig {
  return { formId: '', columns: [], pageSize: 10, allowUserFilter: false, rowClick: 'record' }
}
