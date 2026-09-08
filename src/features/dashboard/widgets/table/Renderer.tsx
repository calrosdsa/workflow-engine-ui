import { nanoid } from '@/features/workflows/builder/nanoid'
import { RecordsTable } from '@/features/forms/runtime/RecordsTable'
import type { WidgetRendererProps } from '../../widget-contract'
import type { TableWidgetConfig } from './schema'
import type { FilterGroup } from '@/features/workflows/types'

// Wraps features/forms/runtime/RecordsTable.tsx (Phase 4) rather than
// re-implementing a record table — the whole point of the Phase 4
// extraction was to give the Search menu and this widget one shared
// implementation. allowFilter is wired to the widget's own allowUserFilter
// toggle (off by default — see schema.ts); title/headerActions are omitted
// since the dashboard tile's own chrome (WidgetTile's title bar) already
// shows the widget's name. rowClick='record' opens RecordsTable's own
// self-contained detail drawer in BOTH builder and runtime mode (safe in
// either — it's a modal, not a page navigation), same as clicking any other
// row anywhere else in the runtime.
//
// scopeToRecord (FR-D2-015): when this instance renders inside a detail-page
// 'custom' tab, recordContext is set and — if scopeToRecord is configured —
// composed with defaultFilter via AND, the same "narrow, never widen"
// contract related_form's own additionalFilter follows. In every other host
// (an ordinary Dashboard menu), recordContext is undefined, so this whole
// branch is dead code and behavior is byte-for-byte unchanged.
function withRecordScope(
  base: FilterGroup | undefined,
  scopeToRecord: TableWidgetConfig['scopeToRecord'],
  recordContext: WidgetRendererProps<TableWidgetConfig>['recordContext'],
): FilterGroup | undefined {
  if (!scopeToRecord || !recordContext) return base
  const scopeCondition = {
    id: nanoid(),
    field: scopeToRecord.fieldName,
    op: 'eq' as const,
    value_mode: 'static' as const,
    value: recordContext.recordId,
  }
  if (!base || (base.conditions.length === 0 && base.groups.length === 0)) {
    return { combinator: 'and', conditions: [scopeCondition], groups: [] }
  }
  return { combinator: 'and', conditions: [scopeCondition], groups: [base] }
}

export function TableRenderer({ config, recordContext }: WidgetRendererProps<TableWidgetConfig>) {
  if (!config.formId) {
    return <div className="flex h-full items-center justify-center p-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No form selected yet.</div>
  }

  return (
    <div className="h-full overflow-auto p-2 text-xs">
      <RecordsTable
        formId={config.formId}
        columns={config.columns}
        defaultFilter={withRecordScope(config.defaultFilter, config.scopeToRecord, recordContext)}
        defaultSort={config.defaultSort}
        pageSize={config.pageSize}
        allowFilter={config.allowUserFilter}
        rowClick={config.rowClick === 'record'}
        footerAggregates={config.footerAggregates}
      />
    </div>
  )
}
