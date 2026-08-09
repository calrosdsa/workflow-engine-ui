// Read-only counterpart to GridCanvas.tsx for the published/runtime render
// (DashboardMenuRuntime) — same react-grid-layout `legacy` entry point and
// the same WidgetLayout -> RGL LayoutItem mapping, but with dragging and
// resizing switched off (isDraggable={false} isResizable={false}) and no
// builder-only chrome (no drag handles, no selection ring, no hover
// toolbar, no keyboard move/resize). Widgets render with mode="runtime" so
// they can navigate and poll for real.
import { ReactGridLayout, WidthProvider, type Layout as RglLayout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import type { Menu } from '@/features/menus/types'
import type { DashboardSchema } from '../schema'
import { getWidget } from '../widget-registry'
import { useIsVisible } from './useIsVisible'

const GridLayoutWithWidth = WidthProvider(ReactGridLayout)

interface RuntimeGridProps {
  schema: DashboardSchema
  clientId: string
  appId: string
  menus?: Menu[]
  onNavigate?: (slug: string) => void
}

export function RuntimeGrid({ schema, clientId, appId, menus, onNavigate }: RuntimeGridProps) {
  const rglLayout: RglLayout = schema.widgets.map((w) => ({
    i: w.id,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: w.layout.minW,
    minH: w.layout.minH,
  }))

  return (
    <div className="h-full flex-1 overflow-auto bg-[hsl(var(--background))]">
      <div className="mx-auto w-full max-w-6xl p-6" style={{ maxWidth: schema.settings.maxWidth }}>
        <GridLayoutWithWidth
          className="dashboard-grid"
          layout={rglLayout}
          cols={schema.settings.cols}
          rowHeight={schema.settings.rowHeight}
          margin={[schema.settings.gap, schema.settings.gap]}
          compactType="vertical"
          isDraggable={false}
          isResizable={false}
        >
          {schema.widgets.map((instance) => (
            <div key={instance.id} className="h-full">
              <RuntimeTile instance={instance} clientId={clientId} appId={appId} menus={menus} onNavigate={onNavigate} />
            </div>
          ))}
        </GridLayoutWithWidth>
      </div>
    </div>
  )
}

function RuntimeTile({ instance, clientId, appId, menus, onNavigate }: {
  instance: DashboardSchema['widgets'][number]
  clientId: string
  appId: string
  menus?: Menu[]
  onNavigate?: (slug: string) => void
}) {
  const def = getWidget(instance.type)
  const [tileRef, isVisible] = useIsVisible<HTMLDivElement>()

  return (
    <div
      ref={tileRef}
      className={`flex h-full flex-col overflow-hidden rounded-lg ${
        instance.chrome === 'card'
          ? 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm'
          : ''
      }`}
    >
      {instance.chrome === 'card' && (instance.title || def) && (
        <div className="shrink-0 border-b border-[hsl(var(--border))] px-3 py-1.5">
          <span className="truncate text-[11px] font-semibold text-[hsl(var(--card-foreground))]">{instance.title || def?.label}</span>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
        {!def ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
            Widget type "{instance.type}" is unavailable.
          </div>
        ) : !isVisible ? (
          <div className="h-full animate-pulse p-3">
            <div className="mb-2 h-3 w-2/3 rounded bg-[hsl(var(--muted))]" />
            <div className="h-3 w-1/2 rounded bg-[hsl(var(--muted))]" />
          </div>
        ) : (
          <def.Renderer
            config={def.parseConfig(instance.config)}
            instance={instance}
            clientId={clientId}
            appId={appId}
            menus={menus}
            onNavigate={onNavigate}
            mode="runtime"
          />
        )}
      </div>
    </div>
  )
}
