import { MoreHorizontal, RotateCw, RefreshCw, Download, ListFilter } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { buildChartCsv, downloadCsv } from './export-csv'
import { findRecordsMenu, navigateToRecords } from './records-link'
import type { ChartWidgetConfig } from './schema'
import type { AggregateGroupResponse } from '@/features/forms/api'
import type { FilterGroup } from '@/features/workflows/types'
import type { Menu } from '@/features/menus/types'

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

  // Menu resolution and navigation both live in records-link.ts, shared
  // with the click-a-data-point path in Renderer.tsx — this item shows
  // every record the chart covers, that one shows the records behind a
  // single group, and they must not drift on which menu they target.
  const targetMenu = findRecordsMenu(config, menus)

  const handleViewRecords = () => {
    if (targetMenu) navigateToRecords(targetMenu, clientId, appId, effectiveFilter)
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
