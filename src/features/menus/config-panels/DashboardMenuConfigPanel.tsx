import { LayoutDashboard, SquareArrowOutUpRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { parseDashboardSchema } from '@/features/dashboard/serialize'
import { Button } from '@/components/ui/button'
import type { Menu, DashboardMenuConfig } from '../types'

interface DashboardMenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
  appId: string
}

// Config panel for the 'dashboard' MenuType — a quick-glance summary plus a
// link to the full-screen editor (DashboardEditorPage, routed at
// /applications/$appId/design/dashboards/$menuId), rather than embedding the
// drag/resize canvas here directly. MenusSection's MenuDetail caps its
// content column at max-w-xl (~528px after padding) — too narrow for
// react-grid-layout's drag/resize interactions and a real settings panel to
// both feel good side by side (confirmed by measurement, same conclusion
// CustomMenuConfigPanel.tsx documents for the page builder's own toolbox).
// Keeping ONE canvas implementation (the full editor's) rather than two
// (this one cramped, a full one elsewhere) avoids the two ever drifting.
export function DashboardMenuConfigPanel({ menu, appId }: DashboardMenuConfigPanelProps) {
  const navigate = useNavigate()
  const config = menu.config as DashboardMenuConfig
  const schema = parseDashboardSchema(config.schema)
  const widgetCount = schema.widgets.length

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
        <LayoutDashboard size={22} className="text-indigo-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">
          {widgetCount === 0 ? 'This dashboard is empty' : `${widgetCount} widget${widgetCount === 1 ? '' : 's'} on this dashboard`}
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Open the full-screen editor to drag, resize, and arrange widgets with room to work.
        </p>
      </div>
      <Button
        type="button"
        className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
        onClick={() => navigate({ to: '/applications/$appId/design/dashboards/$menuId', params: { appId, menuId: menu.id } })}
      >
        <SquareArrowOutUpRight size={14} />
        Open Editor
      </Button>
    </div>
  )
}
