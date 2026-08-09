import { RecordsTable } from '@/features/forms/runtime/RecordsTable'
import type { WidgetRendererProps } from '../../widget-contract'
import type { TableWidgetConfig } from './schema'

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
export function TableRenderer({ config }: WidgetRendererProps<TableWidgetConfig>) {
  if (!config.formId) {
    return <div className="flex h-full items-center justify-center p-3 text-xs text-slate-400">No form selected yet.</div>
  }

  return (
    <div className="h-full overflow-auto p-2 text-xs">
      <RecordsTable
        formId={config.formId}
        columns={config.columns}
        defaultFilter={config.defaultFilter}
        defaultSort={config.defaultSort}
        pageSize={config.pageSize}
        allowFilter={config.allowUserFilter}
        rowClick={config.rowClick === 'record'}
      />
    </div>
  )
}
