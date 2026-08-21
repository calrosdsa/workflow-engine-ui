// Embeds the existing Dashboard widget canvas — RuntimeGrid, the same
// read-only tile renderer DashboardMenuRuntime.tsx already uses — with
// recordContext set, the ONLY difference from that call site. Every widget
// in this tab's schema renders exactly as it would on an ordinary Dashboard
// menu; only a widget that explicitly opts into recordContext (currently
// just the table widget's scopeToRecord, widgets/table/schema.ts) behaves
// any differently here.
import { useAuthStore } from '@/stores/auth'
import { RuntimeGrid } from '@/features/dashboard/canvas/RuntimeGrid'
import '@/features/dashboard/widgets'
import type { DetailTabRendererProps } from '../contract'
import type { CustomTabConfig } from './schema'

export function CustomTabRenderer({ formId, recordId, config }: DetailTabRendererProps<CustomTabConfig>) {
  const activeMembership = useAuthStore((s) => s.activeMembership)
  const clientId = activeMembership?.client_id
  const appId = activeMembership?.app_id

  if (config.schema.widgets.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        This tab has no widgets yet — add some in the Form Builder's Detail Page settings.
      </p>
    )
  }
  if (!clientId || !appId) return null

  return (
    <RuntimeGrid
      schema={config.schema}
      clientId={clientId}
      appId={appId}
      recordContext={{ formId, recordId }}
    />
  )
}
