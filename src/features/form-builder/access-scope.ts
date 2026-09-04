// Round-trip helpers for FormSettings.accessScope ↔ FormDefinition.access_scope.
//
// Same shape of problem as reference-filter.ts (the builder edits each
// rule's filter with UI-only `id` keys the backend has no field for), just
// at the settings level (a whole list of {audience, filter} rules) instead
// of one field's single filter. Reuses reference-filter.ts's per-FilterGroup
// canonical/hydrate/compare functions rather than reimplementing them.

import type { AccessScopeRule } from '@/features/forms/types'
import { canonicalReferenceFilter, hydrateReferenceFilter, sameReferenceFilter } from './reference-filter'

/** Strips UI ids from every rule's filter and normalizes to the backend's
 *  own shape. Unlike a single reference_filter, an EMPTY list here (as
 *  opposed to a list of rules with empty filters) really does mean
 *  "no rules" — undefined, matching the backend's own "absent = unrestricted"
 *  contract, not a degenerate rule. */
export function canonicalAccessScope(rules: AccessScopeRule[] | undefined): AccessScopeRule[] | undefined {
  if (!rules || rules.length === 0) return undefined
  return rules.map((r) => ({
    audience: r.audience.type === 'role'
      ? { type: 'role' as const, role_ids: r.audience.role_ids ?? [] }
      : { type: 'everyone' as const },
    filter: canonicalReferenceFilter(r.filter) ?? { combinator: 'and', conditions: [], groups: [] },
  }))
}

/** Deep-copies a backend rule list, adding the UI ids FilterBuilder requires
 *  to each rule's filter. */
export function hydrateAccessScope(rules: AccessScopeRule[]): AccessScopeRule[] {
  return rules.map((r) => ({ audience: r.audience, filter: hydrateReferenceFilter(r.filter) }))
}

/** True when the two rule lists mean the same thing, ignoring UI ids, key
 *  order, and role_ids array order/dedup within a rule. */
export function sameAccessScope(a: AccessScopeRule[] | undefined, b: AccessScopeRule[] | undefined): boolean {
  const ca = canonicalAccessScope(a)
  const cb = canonicalAccessScope(b)
  if ((ca?.length ?? 0) !== (cb?.length ?? 0)) return false
  if (!ca || !cb) return true // both undefined/empty
  return ca.every((ra, i) => {
    const rb = cb[i]
    if (ra.audience.type !== rb.audience.type) return false
    if (ra.audience.type === 'role') {
      const sa = [...(ra.audience.role_ids ?? [])].sort()
      const sb = [...(rb.audience.role_ids ?? [])].sort()
      if (sa.length !== sb.length || sa.some((id, j) => id !== sb[j])) return false
    }
    return sameReferenceFilter(ra.filter, rb.filter)
  })
}

/** Total leaf conditions across every rule's filter — the config panel's
 *  summary count. */
export function countAccessScopeConditions(rules: AccessScopeRule[] | undefined): number {
  if (!rules) return 0
  return rules.reduce((n, r) => n + countFilterConditions(r.filter), 0)
}

function countFilterConditions(g: AccessScopeRule['filter']): number {
  if (!g) return 0
  return g.conditions.length + (g.groups ?? []).reduce((n, sub) => n + countFilterConditions(sub), 0)
}
