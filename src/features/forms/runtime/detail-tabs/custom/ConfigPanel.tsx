// Deliberately NOT an inline drag/resize canvas — DashboardMenuConfigPanel.tsx
// (features/menus/config-panels/) already established, with measured
// reasoning, that react-grid-layout's drag/resize interactions don't work
// well inside a narrow config-panel column (that one caps at max-w-xl,
// ~528px; this one — the Form Builder's own ConfigPanel.tsx sidebar — is
// w-80, ~320px, narrower still). That precedent's answer was a summary +
// link to a dedicated full-screen editor route, not a cramped inline canvas.
//
// This tab type's own full-screen editor (a Form-detail-tab equivalent of
// DashboardEditorPage.tsx, loading/saving against a Form's detailTabs
// config instead of a Menu's) is real, separate scope this pass does not
// build — flagged here explicitly, not silently faked as a working link,
// per FR-D2-015's own §8 Assumption 2 (this tab type's authoring surface
// was scoped narrower than its runtime binding). Until that editor exists,
// this panel shows what's already configured (read-only summary) and says
// plainly that visual editing isn't available here yet, rather than
// pretending a workable authoring flow exists.
import { LayoutDashboard } from 'lucide-react'
import type { DetailTabConfigPanelProps } from '../contract'
import type { CustomTabConfig } from './schema'

export function CustomTabConfigPanel({ config }: DetailTabConfigPanelProps<CustomTabConfig>) {
  const widgetCount = config.schema.widgets.length

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
        <LayoutDashboard size={18} className="text-indigo-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">
          {widgetCount === 0 ? 'This tab is empty' : `${widgetCount} widget${widgetCount === 1 ? '' : 's'} configured`}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          A visual editor for this tab's widget layout isn't built yet — this configuration was set programmatically or
          via an import. Widgets already here will render normally at runtime.
        </p>
      </div>
    </div>
  )
}
