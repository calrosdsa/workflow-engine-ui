// Config for the built-in 'details' tab type — just an optional list of
// CHILD tabs (the same DetailTabConfig shape group/schema.ts uses) rendered
// as a nested sub-tab-bar below the record's fields. Lets an admin put e.g.
// "Comments" and "History" at the bottom of Details itself, not just as a
// Tab Group living alongside it.
import type { DetailTabConfig } from '@/features/form-builder/schema'

export interface DetailsTabConfig {
  childTabs: DetailTabConfig[]
}

export function emptyDetailsTabConfig(): DetailsTabConfig {
  return { childTabs: [] }
}

export function parseDetailsTabConfig(raw: unknown): DetailsTabConfig {
  if (raw && typeof raw === 'object' && Array.isArray((raw as Partial<DetailsTabConfig>).childTabs)) {
    return { childTabs: (raw as DetailsTabConfig).childTabs }
  }
  return emptyDetailsTabConfig()
}
