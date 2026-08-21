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
  /** FR-D2-015: when this widget renders inside a detail-page 'custom' tab
   *  (WidgetRendererProps.recordContext is set), scopes the table to only
   *  records where `fieldName` equals the current record's id — composed
   *  with defaultFilter via AND, same "narrow, never widen" contract the
   *  related_form tab type's own additionalFilter already follows. Ignored
   *  entirely when recordContext is undefined (an ordinary Dashboard menu),
   *  so this widget's behavior there is completely unchanged. `fieldName`
   *  must be a reference field on `formId` pointing back at the tab's
   *  owning form — same restriction related_form's targetFieldName applies. */
  scopeToRecord?: { fieldName: string }
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
        scopeToRecord: r.scopeToRecord && typeof r.scopeToRecord.fieldName === 'string'
          ? { fieldName: r.scopeToRecord.fieldName }
          : undefined,
      }
    }
  }
  return createDefaultTableConfig()
}

export function createDefaultTableConfig(): TableWidgetConfig {
  return { formId: '', columns: [], pageSize: 10, allowUserFilter: false, rowClick: 'record' }
}
