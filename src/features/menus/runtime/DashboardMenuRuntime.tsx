import { useState } from 'react'
import '@/features/dashboard/widgets'
import { parseDashboardSchema } from '@/features/dashboard/serialize'
import { RuntimeGrid } from '@/features/dashboard/canvas/RuntimeGrid'
import { ParameterBar } from '@/features/dashboard/ParameterBar'
import type { ParameterValues } from '@/features/dashboard/parameters'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { Menu, DashboardMenuConfig } from '../types'

interface DashboardMenuRuntimeProps {
  menu: Menu
  clientId: string
  appId: string
  menus?: Menu[]
  onNavigate?: (slug: string) => void
}

// Real runtime renderer for the 'dashboard' MenuType — renders the same
// widget tiles the builder shows (via RuntimeGrid, a read-only counterpart
// to canvas/GridCanvas.tsx), each in mode="runtime" so navigation/polling
// widgets are fully live.
//
// Parameter values are held HERE rather than in RuntimeGrid, for two
// reasons: the grid is shared with a record's 'custom' detail tab, which has
// no parameter bar; and the values have to outlive any single tile, since
// one control narrows many.
export function DashboardMenuRuntime({ menu, clientId, appId, menus, onNavigate }: DashboardMenuRuntimeProps) {
  const t = useTranslation()
  const config = menu.config as DashboardMenuConfig
  const schema = parseDashboardSchema(config.schema)

  // Viewer-local and deliberately not persisted — the same stance the chart
  // toolbar's own overrides take. Keyed by menu id implicitly: navigating
  // away remounts this component (RuntimeAppShell keys on menu.id), which
  // resets the values, matching what "leave and come back" already does to
  // every other live control.
  const [parameterValues, setParameterValues] = useState<ParameterValues>({})

  if (schema.widgets.length === 0) {
    return <div className="p-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.runtime.dashboard.no_widgets', { name: menu.name })}</div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {schema.parameters?.length ? (
        <ParameterBar parameters={schema.parameters} values={parameterValues} onChange={setParameterValues} />
      ) : null}
      <div className="min-h-0 flex-1">
        <RuntimeGrid
          schema={schema}
          clientId={clientId}
          appId={appId}
          menus={menus}
          onNavigate={onNavigate}
          parameterValues={parameterValues}
        />
      </div>
    </div>
  )
}
