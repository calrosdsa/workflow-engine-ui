import '@/features/dashboard/widgets'
import { parseDashboardSchema } from '@/features/dashboard/serialize'
import { RuntimeGrid } from '@/features/dashboard/canvas/RuntimeGrid'
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
export function DashboardMenuRuntime({ menu, clientId, appId, menus, onNavigate }: DashboardMenuRuntimeProps) {
  const config = menu.config as DashboardMenuConfig
  const schema = parseDashboardSchema(config.schema)

  if (schema.widgets.length === 0) {
    return <div className="p-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>"{menu.name}" has no widgets yet.</div>
  }

  return (
    <RuntimeGrid schema={schema} clientId={clientId} appId={appId} menus={menus} onNavigate={onNavigate} />
  )
}
