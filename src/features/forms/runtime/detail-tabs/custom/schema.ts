import { emptyDashboardSchema, type DashboardSchema } from '@/features/dashboard/schema'
import { parseDashboardSchema } from '@/features/dashboard/serialize'

export interface CustomTabConfig {
  schema: DashboardSchema
}

export function emptyCustomTabConfig(): CustomTabConfig {
  return { schema: emptyDashboardSchema() }
}

// Reuses the Dashboard's own parseDashboardSchema (heals/defaults a
// possibly-stale blob, including `undefined`/malformed input) rather than
// re-deriving the same defensive parsing — this tab type's config IS a
// DashboardSchema, verbatim, wrapped one level for symmetry with every
// other DetailTabDefinition's parseConfig, not a new shape of its own.
export function parseCustomTabConfig(raw: unknown): CustomTabConfig {
  const wrapped = raw && typeof raw === 'object' && 'schema' in raw ? (raw as { schema: unknown }).schema : raw
  return { schema: parseDashboardSchema(wrapped) }
}
