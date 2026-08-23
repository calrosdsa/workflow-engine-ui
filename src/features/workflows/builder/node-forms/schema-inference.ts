// Pure schema-inference logic for the http_request node's auto-map feature:
// given a real parsed JSON response (from POST /http-request/test), propose
// a ResponseSchema — name/kind/fields, including nested-list fields for a
// nested array (see internal/graph/configs_http.go's ResponseSchemaField —
// the 'list' type this proposes into is the one this session's earlier work
// added specifically for this: an order's own line items, etc.).
//
// Pure (no React/network dependency) — cheap to unit-test in isolation, same
// convention as this directory's normalise*Config functions.
import { nanoid } from '../nanoid'
import type { ResponseFieldType, ResponseSchema, ResponseSchemaField } from '../../types'

/** One proposed field, before the author has reviewed/accepted it — carries
 *  everything a ResponseSchemaField does, plus the raw sample value actually
 *  seen (for the review table's preview) and whether it's nested. */
export interface InferredField {
  id: string
  /** JSONPath into the representative element, e.g. "id" or "address.geo.lat". */
  path: string
  type: ResponseFieldType
  /** Proposed display name, e.g. "Id", "Geo Lat" — editable before accepting. */
  name: string
  /** One real value observed at this path, for the review table's preview
   *  column — undefined for a 'list' field (its own nested rows ARE the
   *  preview, shown via `fields`). */
  sample?: unknown
  /** Present only when type === 'list' — this field's own nested proposal,
   *  inferred from the first element of the array found at `path`. */
  fields?: InferredField[]
  /** Whether this row should be included when "Add to schema" is clicked —
   *  defaults to true; the review panel lets an author uncheck noisy/
   *  irrelevant fields (see the mockup's disabled "Catch phrase" row). */
  selected: boolean
}

export interface InferredSchema {
  /** 'list' when the response body (or the array found at the chosen root)
   *  is itself an array; 'single' when it's one object. */
  kind: 'list' | 'single'
  /** How many elements were in the source array — undefined for 'single'.
   *  Purely informational, shown in the review panel's status line. */
  count?: number
  fields: InferredField[]
}

const MAX_INFERENCE_DEPTH = 6 // guards against a pathological/self-referential response shape

/** Infers a schema proposal from a parsed JSON response body. Returns
 *  undefined when the body has no inferable object shape (empty array,
 *  scalar body, null, or an array of scalars — none of which this schema
 *  model has a field-level representation for at the top level). */
export function inferSchemaFromResponse(body: unknown): InferredSchema | undefined {
  if (Array.isArray(body)) {
    const sample = body.find((el) => isPlainObject(el))
    if (!sample) return undefined
    return { kind: 'list', count: body.length, fields: inferFields(sample as Record<string, unknown>, 0) }
  }
  if (isPlainObject(body)) {
    return { kind: 'single', fields: inferFields(body, 0) }
  }
  return undefined
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Walks one object's own keys, flattening nested objects into dot-paths
 *  (matching the schema model's existing "address.geo.lat" convention —
 *  see configs_http.go's ResponseSchemaField doc comment) and proposing a
 *  'list' field for a nested array of objects. A nested array of scalars, or
 *  a value past MAX_INFERENCE_DEPTH, is skipped — this schema model has no
 *  typed representation for either, and silently guessing one would be
 *  worse than omitting the field (an author can still map it by hand). */
function inferFields(obj: Record<string, unknown>, depth: number, pathPrefix = ''): InferredField[] {
  if (depth >= MAX_INFERENCE_DEPTH) return []
  const out: InferredField[] = []

  for (const [key, value] of Object.entries(obj)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key

    if (Array.isArray(value)) {
      const elementSample = value.find((el) => isPlainObject(el))
      if (!elementSample) continue // empty array or array of scalars — no typed shape to propose
      out.push({
        id: nanoid(),
        path,
        type: 'list',
        name: humanizeKey(key),
        fields: inferFields(elementSample as Record<string, unknown>, depth + 1),
        selected: true,
      })
      continue
    }

    if (isPlainObject(value)) {
      out.push(...inferFields(value, depth + 1, path))
      continue
    }

    if (value === null || value === undefined) continue // no type signal to propose from

    out.push({
      id: nanoid(),
      path,
      type: inferScalarType(value),
      name: humanizeKey(key),
      sample: value,
      selected: true,
    })
  }

  return out
}

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

function inferScalarType(value: unknown): ResponseFieldType {
  switch (typeof value) {
    case 'boolean': return 'boolean'
    case 'number': return Number.isInteger(value) ? 'integer' : 'float'
    case 'string': return ISO_DATETIME_RE.test(value) ? 'datetime' : 'string'
    default: return 'string'
  }
}

/** "account_email" -> "Account Email", "createdAt" -> "Created At",
 *  "id" -> "Id" — a readable default name, freely editable before the
 *  author accepts the proposal. Handles snake_case, camelCase, and
 *  kebab-case source keys (the three conventions any real API is likely to
 *  use), falling back to the raw key for anything else (e.g. a key that's
 *  already one capitalized word). */
function humanizeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return key
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Converts an accepted set of InferredFields (post-review, only the
 *  `selected` ones) into the real ResponseSchemaField[] shape the schema
 *  editor consumes — recursively, so a nested list proposal becomes a
 *  nested list field with its own fields carried straight through. Renames
 *  that collide after humanization (two source keys both proposing "Name")
 *  are disambiguated by appending " (2)", " (3)", etc., so "Add to schema"
 *  never silently drops a field to a duplicate-key overwrite downstream. */
export function acceptedFieldsToResponseSchemaFields(fields: InferredField[]): ResponseSchemaField[] {
  const seen = new Map<string, number>()
  const dedupeName = (name: string): string => {
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    return count === 0 ? name : `${name} (${count + 1})`
  }

  return fields
    .filter((f) => f.selected)
    .map((f) => ({
      id: nanoid(),
      path: f.path,
      type: f.type,
      name: dedupeName(f.name),
      ...(f.type === 'list' ? { fields: acceptedFieldsToResponseSchemaFields(f.fields ?? []) } : {}),
    }))
}

/** Builds a full ResponseSchema (id + name + kind + source: 'body' + fields)
 *  from an accepted inference — the review panel's "Add to schema" action
 *  hands this straight to the same onChange the "+ Add New Schema" button
 *  already uses. */
export function inferredSchemaToResponseSchema(name: string, inferred: InferredSchema, selectedFields: InferredField[]): ResponseSchema {
  return {
    id: nanoid(),
    name,
    kind: inferred.kind,
    source: 'body',
    fields: acceptedFieldsToResponseSchemaFields(selectedFields),
  }
}
