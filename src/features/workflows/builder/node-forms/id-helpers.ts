// Re-attach UI-only ids to config sub-trees loaded from the backend (which
// strips them, since graph.FilterGroup/FieldValue/etc. have no id field of
// their own) — shared by the normalise functions across node-forms/*.
import { nanoid } from '../nanoid'
import type {
  FilterGroup, FieldValue, TransformFieldMap, KeyValuePair, ResponseSchema, ResponseSchemaField,
} from '../../types'

export function ensureGroupIds(g: FilterGroup | undefined): FilterGroup | undefined {
  if (!g) return undefined
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map((c) => ({ ...c, id: c.id ?? nanoid() })),
    groups: (g.groups ?? []).map((sub) => ensureGroupIds(sub)!).filter(Boolean),
  }
}

export function ensureValueIds(values: FieldValue[] | undefined): FieldValue[] {
  return (values ?? []).map((v) => ({ ...v, id: v.id ?? nanoid() }))
}

export function ensureMappingIds(mappings: TransformFieldMap[] | undefined): TransformFieldMap[] {
  return (mappings ?? []).map((m) => ({ ...m, id: m.id ?? nanoid() }))
}

export function ensureKeyValueIds(rows: KeyValuePair[] | undefined): KeyValuePair[] {
  return (rows ?? []).map((r) => ({ ...r, id: r.id ?? nanoid() }))
}

// A 'list'-typed field nests its own field list arbitrarily deep (an
// order's items, each item's own sub-components, ...) — mirrors
// ensureGroupIds' recursive shape for FilterGroup, one level per nesting
// instead of FilterGroup's fixed two.
function ensureResponseFieldIds(fields: ResponseSchemaField[] | undefined): ResponseSchemaField[] {
  return (fields ?? []).map((f) => ({
    ...f,
    id: f.id ?? nanoid(),
    fields: f.type === 'list' ? ensureResponseFieldIds(f.fields) : undefined,
  }))
}

// One level deeper than ensureKeyValueIds — each schema needs an id AND its
// nested fields array needs ids of its own (mirrors how ensureGroupIds
// recurses one level deeper than ensureValueIds for fetch_records filters).
export function ensureResponseSchemaIds(schemas: ResponseSchema[] | undefined): ResponseSchema[] {
  return (schemas ?? []).map((s) => ({
    ...s,
    id: s.id ?? nanoid(),
    fields: ensureResponseFieldIds(s.fields),
  }))
}
