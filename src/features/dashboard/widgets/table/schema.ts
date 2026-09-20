import type { ConfigSchema } from '@/lib/config-schema'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type { AggregateFn } from '@/features/forms/api'

export type TableRowClick = 'none' | 'record'

export interface TableFooterAggregate {
  field: string
  fn: AggregateFn
}

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
  /** One summary-row aggregate per numeric field, opt-in — computed via the
   *  same /records/aggregate series call the chart widget already uses
   *  (no group_by), covering every record matching defaultFilter/a live
   *  viewer filter, not just the current page. A field absent here renders
   *  a blank footer cell. */
  footerAggregates?: TableFooterAggregate[]
}

const VALID_ROW_CLICK: TableRowClick[] = ['none', 'record']
const VALID_FNS: AggregateFn[] = ['count', 'sum', 'avg', 'min', 'max']

function parseFooterAggregates(raw: unknown): TableFooterAggregate[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const parsed = raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .filter((a) => typeof a.field === 'string' && a.field && typeof a.fn === 'string' && VALID_FNS.includes(a.fn as AggregateFn))
    .map((a) => ({ field: a.field as string, fn: a.fn as AggregateFn }))
  return parsed.length > 0 ? parsed : undefined
}

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
        footerAggregates: parseFooterAggregates(r.footerAggregates),
      }
    }
  }
  return createDefaultTableConfig()
}

export function createDefaultTableConfig(): TableWidgetConfig {
  return { formId: '', columns: [], pageSize: 10, allowUserFilter: false, rowClick: 'record' }
}

export const TABLE_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'A live records table for one form — a glanceable tile, not a full search page.',
  required: ['formId', 'columns', 'pageSize'],
  properties: {
    formId: { type: 'string', description: 'Id of the form whose records to list.' },
    columns: { type: 'array', items: { type: 'string', fieldRef: true }, description: 'Field names to show as columns, in order.' },
    defaultFilter: { type: 'object', description: 'A FilterGroup applied server-side. Same grammar as workflow nodes.' },
    defaultSort: { type: 'array', items: { type: 'object' }, description: 'SortRule list applied by default.' },
    pageSize: { type: 'integer', description: 'Rows per page. Tile-appropriate default is 10.' },
    allowUserFilter: { type: 'boolean', description: 'Let the viewer add their own filters on the tile.' },
    rowClick: { type: 'string', enum: ['none', 'record'], description: "What clicking a row does: nothing, or open the record's detail." },
    scopeToRecord: {
      type: 'object',
      required: ['fieldName'],
      properties: { fieldName: { type: 'string', fieldRef: true } },
      description: "Only meaningful inside a detail-page 'custom' tab: narrows the table to records whose reference field `fieldName` points at the record being viewed. Ignored on a Dashboard menu.",
    },
    footerAggregates: {
      type: 'array',
      description: 'One summary-row aggregate per numeric field, opt-in. Computed over every matching record (all pages), not just the visible page. A field not listed here renders a blank footer cell.',
      items: {
        type: 'object',
        required: ['field', 'fn'],
        properties: {
          field: { type: 'string', fieldRef: true, description: 'A numeric field on this widget\'s form.' },
          fn: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] },
        },
      },
    },
  },
}
