import { AlertTriangle, Copy, Settings2, Trash2 } from 'lucide-react'
import { cn, onKeyboardActivate } from '@/lib/utils'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { getWidget } from '../widget-registry'
import { useIsVisible } from './useIsVisible'
import { resolveLayoutKeyAction, type LayoutKeyAction } from './keyboardLayout'
import type { WidgetInstance } from '../schema'
import type { WidgetDefinition } from '../widget-contract'

interface WidgetTileProps {
  instance: WidgetInstance
  clientId: string
  appId: string
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  /** Applies a resolved keyboard move/resize action to this tile — the
   *  STORE (not this component) computes the resulting layout, reading the
   *  widget's current layout fresh from state at apply time rather than
   *  from this render's `instance` prop. That distinction matters: holding
   *  an arrow key down fires several keydown events before React commits a
   *  re-render, so a version of this that computed the new layout here
   *  (from `instance.layout`, a snapshot of this specific render) would
   *  have every rapid-fire keypress compute from the same stale base,
   *  silently collapsing N keypresses into one — see
   *  docs/dashboard-system-plan.md section 9's a11y hardening item. */
  onKeyboardLayoutAction: (action: LayoutKeyAction) => void
}

// Renders one widget's chrome + body inside a canvas tile. GridCanvas hands
// this component a plain div per tile (react-grid-layout only ever sees an
// opaque child) — everything widget-specific happens here, so RGL's props
// never reach a widget plugin. mode is always 'builder': widgets are shown
// live but inert, matching WidgetRendererProps' documented contract (no
// navigation side effects, polling paused) while the dashboard is being
// edited.
//
// An instance whose `type` no longer resolves in the registry (a plugin
// removed/renamed after this dashboard was built) renders the "Unavailable
// widget" fallback below instead of crashing — this, together with
// serialize.ts preserving the instance untouched, is what makes the plugin
// registry safe to change over time: the dashboard keeps loading, keeps
// saving, and the tile can still be moved/resized/deleted even though its
// content can't render.
export function WidgetTile({ instance, clientId, appId, selected, onSelect, onDuplicate, onDelete, onKeyboardLayoutAction }: WidgetTileProps) {
  const t = useTranslation()
  const def = getWidget(instance.type)
  // Defers mounting the widget's real Renderer (and therefore any data
  // query it fires) until the tile is at least near the viewport — see
  // useIsVisible's doc comment and docs/dashboard-system-plan.md section
  // 9's "lazy-mount offscreen widgets" hardening item. Runs unconditionally
  // (not skipped for an unresolved `def`) since observing a plain div costs
  // nothing and keeps the hook order stable regardless of registry state.
  const [tileRef, isVisible] = useIsVisible<HTMLDivElement>()

  // Enter/Space selects the tile, via the same onKeyboardActivate() used
  // by every other selectable-card shape in this repo (e.g. detail-page-
  // builder/canvas/TabCard.tsx) — its own e.target === e.currentTarget
  // guard stops a keydown bubbling up from the drag handle or the
  // Configure/Duplicate/Delete buttons below from ALSO re-triggering
  // onSelect, the same reason their onClick needs e.stopPropagation() on
  // the mouse side. Checking e.defaultPrevented afterward is how this
  // composes with the arrow-key handling below: onKeyboardActivate only
  // calls preventDefault() when it actually matched, so every other key
  // (including Tab and text-field arrows inside a widget's own config UI)
  // still falls through untouched.
  //
  // Arrow-key move/resize below only acts once the tile is already
  // selected AND has focus, so arrow keys don't hijack normal page
  // scrolling the rest of the time. It only RESOLVES the key into an
  // action here — applying it against the widget's current layout happens
  // in the store (see onKeyboardLayoutAction's doc comment above).
  const activateOnSelect = onKeyboardActivate<HTMLDivElement>(onSelect)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    activateOnSelect(e)
    if (e.defaultPrevented) return
    if (!selected) return
    const action = resolveLayoutKeyAction(e.key, e.shiftKey)
    if (!action) return
    e.preventDefault()
    e.stopPropagation()
    onKeyboardLayoutAction(action)
  }

  const tileName = instance.title || (def ? t(`builder.dashboard.${instance.type}.label`) : instance.type)

  return (
    <div
      ref={tileRef}
      role="group"
      aria-label={`${tileName} ${t('builder.dashboard.tile_aria_widget')}${selected ? ` — ${t('builder.dashboard.tile_aria_selected')}` : ''}`}
      tabIndex={0}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-lg transition-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/60 focus-visible:ring-offset-1',
        instance.chrome === 'card' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm',
        selected && 'ring-2 ring-[hsl(var(--primary))]/60 ring-offset-1',
      )}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onKeyDown={handleKeyDown}
    >
      {(instance.chrome === 'card' && (instance.title || def)) && (
        <div className="widget-drag-handle flex shrink-0 cursor-grab items-center justify-between border-b border-[hsl(var(--border))] px-3 py-1.5 active:cursor-grabbing">
          <span className="truncate text-[11px] font-semibold text-[hsl(var(--foreground))]/80">
            {tileName}
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
        {!def ? (
          <UnavailableWidget type={instance.type} />
        ) : !isVisible ? (
          <TilePlaceholder def={def} instance={instance} clientId={clientId} appId={appId} />
        ) : (
          <def.Renderer
            config={def.parseConfig(instance.config)}
            instance={instance}
            clientId={clientId}
            appId={appId}
            mode="builder"
          />
        )}
      </div>

      {/* Tile toolbar — shown on hover/selection, not baked into normal flow
          so it never competes for space with the widget's own content. */}
      <div
        className={cn(
          'absolute right-1 top-1 flex items-center gap-0.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-0.5 opacity-0 shadow-sm transition-opacity',
          'group-hover:opacity-100',
          selected && 'opacity-100',
        )}
      >
        <button
          type="button"
          title={t('common.configure')}
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        >
          <Settings2 size={13} />
        </button>
        <button
          type="button"
          title={t('common.duplicate')}
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          title={t('common.delete')}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function UnavailableWidget({ type }: { type: string }) {
  const t = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-[hsl(var(--muted))] p-4 text-center">
      <AlertTriangle size={18} className="text-[hsl(var(--muted-foreground))]/60" />
      <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard.unavailable')}</p>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]/70">{t('builder.dashboard.unavailable_detail', { type })}</p>
    </div>
  )
}

// Shown instead of a widget's real Renderer before its tile has ever been
// visible (see useIsVisible). Prefers the widget's own BuilderPreview when
// it defines one — a lighter, side-effect-free stand-in the widget author
// controls — falling back to a generic pulse skeleton for the majority of
// widgets that don't need anything fancier than "something is here".
function TilePlaceholder({ def, instance, clientId, appId }: {
  def: WidgetDefinition
  instance: WidgetInstance
  clientId: string
  appId: string
}) {
  if (def.BuilderPreview) {
    return (
      <def.BuilderPreview
        config={def.parseConfig(instance.config)}
        instance={instance}
        clientId={clientId}
        appId={appId}
        mode="builder"
      />
    )
  }
  return (
    <div className="h-full animate-pulse p-3">
      <div className="mb-2 h-3 w-2/3 rounded bg-[hsl(var(--muted))]" />
      <div className="h-3 w-1/2 rounded bg-[hsl(var(--muted))]" />
    </div>
  )
}
