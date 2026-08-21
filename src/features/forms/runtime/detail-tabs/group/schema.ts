// A "Tab Group" — nested tabs. Its own config is a list of CHILD tab
// configs (the exact same DetailTabConfig shape the top-level tab list
// uses), so any registered type — including another group — can be nested
// inside one. This is what lets "Comments" and "History" render as a
// sub-tab-bar wherever an admin places the group (below a form's fields, as
// its own top-level tab, or nested inside another group), rather than a
// one-off "Comments+History under Details" special case.
import type { DetailTabConfig } from '@/features/form-builder/schema'

export interface GroupTabConfig {
  tabs: DetailTabConfig[]
}

export function emptyGroupTabConfig(): GroupTabConfig {
  return { tabs: [] }
}

export function parseGroupTabConfig(raw: unknown): GroupTabConfig {
  if (raw && typeof raw === 'object' && Array.isArray((raw as Partial<GroupTabConfig>).tabs)) {
    return { tabs: (raw as GroupTabConfig).tabs }
  }
  return emptyGroupTabConfig()
}
