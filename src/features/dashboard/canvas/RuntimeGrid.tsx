// Read-only counterpart to GridCanvas.tsx for the published/runtime render
// (DashboardMenuRuntime) — same react-grid-layout `legacy` entry point and
// the same WidgetLayout -> RGL LayoutItem mapping, but with dragging and
// resizing switched off (isDraggable={false} isResizable={false}) and no
// builder-only chrome (no drag handles, no selection ring, no hover
// toolbar, no keyboard move/resize). Widgets render with mode="runtime" so
// they can navigate and poll for real.
//
// Responsive below the `sm` breakpoint (per docs/dashboard-system-plan.md
// section 4.1): uses ResponsiveReactGridLayout (aliased `Responsive`) rather
// than the plain ReactGridLayout GridCanvas.tsx uses, since the builder's
// own canvas is deliberately desktop-only. The `sm` breakpoint's layout is
// a single-column stack, computed from `schema.widgets` sorted by y then x
// (schema.widgets carries no explicit ordering field of its own — the
// authored x/y grid position IS the intended order at every breakpoint).
import { Responsive, WidthProvider, type Layout as RglLayout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import type { Menu } from '@/features/menus/types'
import type { DashboardSchema } from '../schema'
import { getWidget } from '../widget-registry'
import { useIsVisible } from './useIsVisible'

const ResponsiveGridLayoutWithWidth = WidthProvider(Responsive)

const BREAKPOINTS = { lg: 640, sm: 0 }
const SINGLE_COLUMN_COLS = 1

interface RuntimeGridProps {
  schema: DashboardSchema
  clientId: string
  appId: string
  menus?: Menu[]
  onNavigate?: (slug: string) => void
  /** Threaded straight through to every tile's WidgetRendererProps — set
   *  only when this grid itself is rendering inside a detail-page 'custom'
   *  tab (FR-D2-015's DashboardMenuRuntime.tsx call site never sets this,
   *  so an ordinary Dashboard menu is unaffected). */
  recordContext?: { formId: string; recordId: string }
}

export function RuntimeGrid({ schema, clientId, appId, menus, onNavigate, recordContext }: RuntimeGridProps) {
  const wideLayout: RglLayout = schema.widgets.map((w) => ({
    i: w.id,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: w.layout.minW,
    minH: w.layout.minH,
  }))

  const narrowLayout: RglLayout = [...schema.widgets]
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
    .map((w, i) => ({
      i: w.id,
      x: 0,
      y: i,
      w: SINGLE_COLUMN_COLS,
      h: w.layout.h,
      minW: SINGLE_COLUMN_COLS,
      minH: w.layout.minH,
    }))

  return (
    <div className="h-full flex-1 overflow-auto bg-[hsl(var(--background))]">
      <div className="mx-auto w-full max-w-6xl p-6" style={{ maxWidth: schema.settings.maxWidth }}>
        <ResponsiveGridLayoutWithWidth
          className="dashboard-grid"
          layouts={{ lg: wideLayout, sm: narrowLayout }}
          breakpoints={BREAKPOINTS}
          cols={{ lg: schema.settings.cols, sm: SINGLE_COLUMN_COLS }}
          rowHeight={schema.settings.rowHeight}
          margin={[schema.settings.gap, schema.settings.gap]}
          compactType="vertical"
          isDraggable={false}
          isResizable={false}
        >
          {schema.widgets.map((instance) => (
            <div key={instance.id} className="h-full">
              <RuntimeTile instance={instance} clientId={clientId} appId={appId} menus={menus} onNavigate={onNavigate} recordContext={recordContext} />
            </div>
          ))}
        </ResponsiveGridLayoutWithWidth>
      </div>
    </div>
  )
}

function RuntimeTile({ instance, clientId, appId, menus, onNavigate, recordContext }: {
  instance: DashboardSchema['widgets'][number]
  clientId: string
  appId: string
  menus?: Menu[]
  onNavigate?: (slug: string) => void
  recordContext?: { formId: string; recordId: string }
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
            recordContext={recordContext}
          />
        )}
      </div>
    </div>
  )
}
