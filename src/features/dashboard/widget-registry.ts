// ---------------------------------------------------------------------------
// Widget registry
// ---------------------------------------------------------------------------
//
// Direct structural analog of features/menus/menu-registry.ts's
// MENU_TYPE_REGISTRY, as a Map instead of a Record since the widget type set
// is open-ended (new plugin folders register themselves at import time)
// rather than a small fixed union like MenuType.
//
// The dashboard canvas, persistence, and settings drawer only ever go
// through getWidget()/registerWidget() — none of them switch on widget type
// themselves, matching the same "zero edits to the core" guarantee
// menu-registry.ts documents for MenuType.
//
// This Map is plain mutable module state, not reactive — nothing
// re-renders when registerWidget() is called. That's fine as long as every
// registration happens at import time (widgets/index.ts imports every
// widgets/<type>/index.ts, each of which calls registerWidget once at
// module scope), which guarantees the registry is fully populated before
// any component using it ever mounts. Calling registerWidget() later (e.g.
// from inside a useEffect, or behind a dynamic import triggered by user
// interaction) will NOT update any already-rendered Toolbox/GridCanvas —
// don't register widgets lazily unless a reactive rebuild is added
// alongside it.
import type { WidgetDefinition, WidgetCategory } from './widget-contract'

const REGISTRY = new Map<string, WidgetDefinition<any>>()

/** Registers a widget type. Called once at module load by each
 *  widgets/<type>/index.ts (imported, in turn, exactly once from
 *  widgets/index.ts). Throws on a duplicate type in production — a silent
 *  overwrite would make the second registration win in an order that
 *  depends on import order, which is exactly the kind of load-bearing
 *  implicit ordering the registry pattern exists to avoid.
 *
 *  In dev (import.meta.hot defined), a duplicate is instead a silent
 *  overwrite. Vite's HMR can re-run every registerWidget() call from
 *  several different propagation paths (editing the widget's own
 *  Renderer/ConfigPanel/schema, or something upstream like
 *  RuntimeAppShell/menu-registry that re-imports widgets/index.ts while
 *  propagating its own update) without disposing the old module first —
 *  throwing there wedges the whole module graph with an uncaught error
 *  until a full page reload. A `import.meta.hot.dispose` clearing the
 *  registry was tried at widgets/index.ts and proved unreliable (only
 *  fires for a hot update accepted at that exact module, not the other
 *  propagation paths above it), so overwrite-on-duplicate is the dev-mode
 *  behavior instead — it doesn't depend on which module Vite decided to
 *  re-run. Note this was NOT the cause of the specific "navigating between
 *  menus shows raw field keys instead of labels" bug this comment used to
 *  describe — that turned out to be a missing `key` on RuntimeAppShell's
 *  <RuntimeRenderer>, letting React reuse a stale RecordsTable instance
 *  across menus of the same type. This guard is a separate, general dev-
 *  mode HMR robustness fix: a genuine accidental duplicate type still
 *  surfaces as a production build error (thrown below), just not
 *  immediately in dev. */
export function registerWidget<T>(def: WidgetDefinition<T>): void {
  if (REGISTRY.has(def.type) && !import.meta.hot) {
    throw new Error(`widget type "${def.type}" is already registered`)
  }
  REGISTRY.set(def.type, def)
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return REGISTRY.get(type)
}

export function allWidgets(): WidgetDefinition[] {
  return Array.from(REGISTRY.values())
}

export function widgetsByCategory(category: WidgetCategory): WidgetDefinition[] {
  return allWidgets().filter((w) => w.category === category)
}

export const WIDGET_CATEGORIES: WidgetCategory[] = ['Content', 'Data', 'Navigation', 'Embed']

/** Test-only escape hatch — production code never needs to unregister a
 *  widget, but vitest suites that register a throwaway fake type per-test
 *  need a way to reset between tests without leaking into other suites. */
export function resetRegistry(): void {
  REGISTRY.clear()
}
