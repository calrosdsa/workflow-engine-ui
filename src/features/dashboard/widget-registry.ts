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
 *  widgets/index.ts). Throws on a duplicate type — a silent overwrite would
 *  make the second registration win in an order that depends on import
 *  order, which is exactly the kind of load-bearing implicit ordering the
 *  registry pattern exists to avoid. */
export function registerWidget<T>(def: WidgetDefinition<T>): void {
  if (REGISTRY.has(def.type)) {
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
export function _resetRegistryForTests(): void {
  REGISTRY.clear()
}
