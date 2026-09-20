// Verification harness for the dashboard canvas (Phase 2/3 of
// docs/dashboard-system-plan.md) — mounts DashboardBuilderDnd + Toolbox +
// GridCanvas + WidgetSettingsDrawer standalone, with no backend/menu
// dependency. Not linked from any nav; reachable only by navigating directly
// to /dev/dashboard-builder. Mirrors pages/dev/PageBuilderHarness.tsx's
// precedent for this kind of isolated interactive verification.
//
// Registers the real built-in widgets (features/dashboard/widgets) — as of
// Phase 3 these are the 7 content/quick-links widgets; Data/Embed widgets
// land in later phases and will show up here automatically once registered,
// with no changes needed to this file.
import '@/features/dashboard/widgets'
import { useDashboardStore } from '@/features/dashboard/store'
import { allWidgets } from '@/features/dashboard/widget-registry'
import { DashboardBuilderDnd } from '@/features/dashboard/canvas/DashboardBuilderDnd'
import { GridCanvas } from '@/features/dashboard/canvas/GridCanvas'
import { DashboardToolbox } from '@/features/dashboard/Toolbox'
import { WidgetSettingsDrawer } from '@/features/dashboard/WidgetSettingsDrawer'

export function DashboardBuilderHarness() {
  const schema = useDashboardStore((s) => s.schema)
  const addWidget = useDashboardStore((s) => s.addWidget)

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <h1 className="text-sm font-semibold">Dashboard builder harness</h1>
        {/* Quick "add one of every type" row — dragging from the toolbox
            exercises dnd-kit, this exercises addWidget for every registered
            type directly without needing a drag gesture per type. */}
        <div className="flex flex-wrap gap-1">
          {allWidgets().map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => addWidget(def.type)}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
            >
              +{def.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <DashboardBuilderDnd>
          <DashboardToolbox parameters />
          <GridCanvas
            clientId="dev-client"
            appId="dev-app"
            onAddFirstWidget={() => addWidget('paragraph')}
          />
          <WidgetSettingsDrawer clientId="dev-client" appId="dev-app" />
        </DashboardBuilderDnd>
        <div className="w-80 shrink-0 overflow-y-auto border-l bg-slate-900 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Live schema</p>
          <pre className="text-[10px] text-emerald-300">{JSON.stringify(schema, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
