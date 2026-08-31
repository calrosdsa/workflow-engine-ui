// Frontend block-type registry (3.3 §J, FR-J1-001 §1) — Map-keyed-by-type,
// throw-on-duplicate, direct structural clone of dashboard's own
// widget-registry.ts. This is the DESIGN-TIME/canvas-side registry; the
// backend has its own independent registry (internal/reports/registry.go,
// RegisterBlockType) driving actual generation — the two share the same
// block-type vocabulary ("table", "group") by convention, not by any shared
// code, the same "envelope is schema-typed, payload is registry-typed" split
// FR-J1-003 already documents between ReportBlock.config and each block
// type's own registration.
import type { ReportBlockDefinition } from './report-block-contract'

const REGISTRY = new Map<string, ReportBlockDefinition<any>>()

export function registerReportBlock<T>(def: ReportBlockDefinition<T>): void {
  if (REGISTRY.has(def.type) && !import.meta.hot) {
    throw new Error(`report block type "${def.type}" is already registered`)
  }
  REGISTRY.set(def.type, def)
}

export function getReportBlock(type: string): ReportBlockDefinition | undefined {
  return REGISTRY.get(type)
}

export function allReportBlocks(): ReportBlockDefinition[] {
  return Array.from(REGISTRY.values())
}

export function resetReportBlockRegistry(): void {
  REGISTRY.clear()
}
