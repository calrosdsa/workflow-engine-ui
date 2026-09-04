// Round-trip helpers for FormElement.referenceFilter ↔ FieldDef.reference_filter.
//
// The builder edits the filter with UI-only `id` keys on every group and
// condition (FilterBuilder needs them for list rendering and update-by-id),
// but the backend's graph.Condition has no id field at all — ids sent on a
// save are silently dropped by Go's decode/re-marshal. So the two copies of
// the "same" filter are never byte-equal, and three jobs need a canonical,
// id-free form:
//
//   • projection (projection.ts) emits the canonical form, so what the
//     backend stores is exactly what it would echo back
//   • heal-on-load (heal.ts) compares canonical forms to decide whether an
//     API/MCP-authored filter diverged from the layout's copy — and if so
//     hydrates the backend's copy (ids re-added) INTO the layout, following
//     the createUser-mirror rule: backend-enforced settings are the truth,
//     and a builder save must round-trip them, never clobber them. Dropping
//     a reference_filter silently would WIDEN what the field's picker and
//     write gate allow — the exact anti-silent-widening rule the server
//     enforces on its side by failing closed.
//   • the config panel summarizes it (condition count)

import type { FilterGroup, FilterCondition } from '@/features/workflows/types'
import { nanoid } from '@/features/workflows/builder/nanoid'

/** Strips UI ids and normalizes to the backend's own shape/key order.
 *  Returns undefined for an empty filter (no conditions anywhere) — an empty
 *  group constrains nothing, so it projects to "no filter" rather than
 *  storing a vacuous rule. `expression` is dropped outright: the backend
 *  refuses value_mode 'expression' on this surface, so a lingering
 *  expression string is dead weight; `value_mode: 'static'` is normalized
 *  to absent, matching a backend copy authored without the key. */
export function canonicalReferenceFilter(g: FilterGroup | undefined): FilterGroup | undefined {
  if (!g) return undefined
  const conditions = g.conditions.map(canonicalCondition)
  const groups = (g.groups ?? [])
    .map(canonicalReferenceFilter)
    .filter((sub): sub is FilterGroup => sub !== undefined)
  if (conditions.length === 0 && groups.length === 0) return undefined
  return { combinator: g.combinator === 'or' ? 'or' : 'and', conditions, groups }
}

function canonicalCondition(c: FilterCondition): FilterCondition {
  const out: FilterCondition = { field: c.field, op: c.op } as FilterCondition
  if (c.value_mode && c.value_mode !== 'static') out.value_mode = c.value_mode
  if (c.value !== undefined && c.value !== '') out.value = c.value
  return out
}

/** Deep-copies a backend filter, adding the UI ids FilterBuilder requires.
 *  Existing ids are kept, so hydrating an already-hydrated filter is a no-op
 *  apart from the copy. */
export function hydrateReferenceFilter(g: FilterGroup): FilterGroup {
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator === 'or' ? 'or' : 'and',
    conditions: g.conditions.map((c) => ({
      value_mode: 'static',
      ...c,
      id: c.id ?? nanoid(),
    })),
    groups: (g.groups ?? []).map(hydrateReferenceFilter),
  }
}

/** True when the two filters mean the same thing, ignoring UI ids, key
 *  order, an explicit-vs-absent 'static' value_mode, and empty groups.
 *  Both sides pass through canonicalReferenceFilter, whose output has a
 *  fixed key order — so stringify comparison is deterministic. */
export function sameReferenceFilter(a: FilterGroup | undefined, b: FilterGroup | undefined): boolean {
  return JSON.stringify(canonicalReferenceFilter(a) ?? null) === JSON.stringify(canonicalReferenceFilter(b) ?? null)
}

/** Total leaf conditions across the whole tree — the config panel's summary. */
export function countFilterConditions(g: FilterGroup | undefined): number {
  if (!g) return 0
  return g.conditions.length + (g.groups ?? []).reduce((n, sub) => n + countFilterConditions(sub), 0)
}
