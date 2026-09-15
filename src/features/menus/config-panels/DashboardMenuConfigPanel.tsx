import { LayoutDashboard, SquareArrowOutUpRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { parseDashboardSchema } from '@/features/dashboard/serialize'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/features/i18n/I18nProvider'
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
  const t = useTranslation()
  const navigate = useNavigate()
  const config = menu.config as DashboardMenuConfig
  const schema = parseDashboardSchema(config.schema)
  const widgetCount = schema.widgets.length

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10">
        <LayoutDashboard size={22} className="text-[hsl(var(--primary))]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]/80">
          {widgetCount === 0
            ? t('menus.config_panels.dashboard.empty')
            : t(widgetCount === 1 ? 'menus.config_panels.dashboard.widget_count_one' : 'menus.config_panels.dashboard.widget_count_many', { count: widgetCount })}
        </p>
        <p className="mt-1 max-w-xs text-xs text-[hsl(var(--muted-foreground))]">
          {t('menus.config_panels.dashboard.open_hint')}
        </p>
      </div>
      <Button
        type="button"
        className="gap-1.5"
        onClick={() => navigate({ to: '/applications/$appId/design/dashboards/$menuId', params: { appId, menuId: menu.id } })}
      >
        <SquareArrowOutUpRight size={14} />
        {t('menus.config_panels.dashboard.open_button')}
      </Button>
    </div>
  )
}
