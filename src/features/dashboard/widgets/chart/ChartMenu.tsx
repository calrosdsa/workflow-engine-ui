import { MoreHorizontal, RotateCw, RefreshCw, Download, ListFilter } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { runtimeRouter } from '@/runtime-router'
import { buildChartCsv, downloadCsv } from './export-csv'
import type { ChartWidgetConfig } from './schema'
import type { AggregateGroupResponse } from '@/features/forms/api'
import type { FilterGroup } from '@/features/workflows/types'
import type { Menu, SearchMenuConfig } from '@/features/menus/types'

interface ChartMenuProps {
  config: ChartWidgetConfig
  clientId: string
  appId: string
  menus: Menu[] | undefined
  groups: AggregateGroupResponse[]
  sourceFormName: string | undefined
  effectiveFilter: FilterGroup | undefined
  onRefresh: () => void
  onReset: () => void
}

/** The chart widget's "..." menu (Refresh / Reset / Export / View records) —
 *  kept as its own component, separate from RuntimeToolbar's data-shaping
 *  controls, since these are one-shot actions/navigation rather than
 *  persistent filter state. Structurally mirrors RecordDetailToolbar.tsx's
 *  kebab (MoreHorizontal trigger, #runtime-root portal). No "Edit" item —
 *  that's a builder/design-time affordance, out of scope for the runtime
 *  viewer controls this widget is gaining. */
export function ChartMenu({ config, clientId, appId, menus, groups, sourceFormName, effectiveFilter, onRefresh, onReset }: ChartMenuProps) {
  const t = useTranslation()

  // "View records" only ever targets a Search menu whose own form_id
  // matches this chart's source form — and only when that menu is in the
  // viewer-visible `menus` snapshot already handed down to every widget
  // (the same visibility guarantee the quick-links widget's isVisible()
  // relies on: "not in `menus`" already means "this viewer can't see it").
  const targetMenu = menus?.find((m) => m.menu_type === 'search' && (m.config as SearchMenuConfig).form_id === config.formId)

  const handleViewRecords = () => {
    if (!targetMenu) return
    // `to` is a dynamic template string, so TanStack Router can't resolve
    // which registered route it targets at the type level — same situation
    // RuntimeLink.tsx's own comment documents. Assigning `search` to a
    // widely-typed variable first (rather than passing a fresh object
    // literal inline) sidesteps excess-property-checking against whatever
    // unrelated route's search shape the navigate() overload resolves to,
    // the same technique RuntimeLink.tsx already uses.
    const search: Record<string, string> = effectiveFilter ? { ef: JSON.stringify(effectiveFilter) } : {}
    runtimeRouter.navigate({ to: `/${clientId}/${appId}/${targetMenu.slug}`, search })
  }

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const base = (sourceFormName ?? 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'chart'
    downloadCsv(buildChartCsv(config, groups), `${base}-${stamp}.csv`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('runtime.dashboard_chart.menu.label')}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
      >
        <MoreHorizontal size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" container={document.getElementById('runtime-root')}>
        <DropdownMenuItem onClick={onRefresh}>
          <RefreshCw size={13} />{t('runtime.dashboard_chart.menu.refresh')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReset}>
          <RotateCw size={13} />{t('runtime.dashboard_chart.menu.reset')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExport}>
          <Download size={13} />{t('runtime.dashboard_chart.menu.export')}
        </DropdownMenuItem>
        {targetMenu && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleViewRecords}>
              <ListFilter size={13} />{t('runtime.dashboard_chart.menu.view_records')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
