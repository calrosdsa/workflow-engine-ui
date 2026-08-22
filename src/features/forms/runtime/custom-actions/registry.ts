// ---------------------------------------------------------------------------
// Custom-action registry (FR-D2-017)
// ---------------------------------------------------------------------------
//
// Direct structural analog of detail-tabs/registry.ts — same Map-backed
// registration, same production-throw/dev-overwrite duplicate handling
// (Vite's HMR can re-run every registerX() call from several different
// propagation paths without disposing the old module first, the same
// failure mode detail-tabs/registry.ts's own comment documents).
import type { CustomActionDefinition } from './contract'

const REGISTRY = new Map<string, CustomActionDefinition<any>>()

export function registerCustomAction<T>(def: CustomActionDefinition<T>): void {
  if (REGISTRY.has(def.type) && !import.meta.hot) {
    throw new Error(`custom action type "${def.type}" is already registered`)
  }
  REGISTRY.set(def.type, def)
}

export function getCustomAction(type: string): CustomActionDefinition | undefined {
  return REGISTRY.get(type)
}

export function allCustomActions(): CustomActionDefinition[] {
  return Array.from(REGISTRY.values())
}
