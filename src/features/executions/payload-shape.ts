// Decides whether a node's Input/Output payload (arbitrary JSON — nested
// objects, a single record, a plain variable map, or a genuine array of
// records) should render as a DataTable or fall back to this codebase's
// existing raw-JSON <pre> dump convention (see BaseNode.tsx's debug-snapshot
// popover, ExecutionsSidebar.tsx's <details>, ExecutionDetailPage.tsx's
// Final Variables card). The <pre> dump is the safe default; a table is
// only offered for the common "array of reasonably uniform objects" case —
// every other shape (a bare object, a scalar array, disjoint-keyed objects,
// an unreasonably wide object) stays raw rather than rendering a
// misleading/unreadable table.
export type PayloadShape =
  | { kind: 'table'; columns: string[]; rows: Record<string, unknown>[] }
  | { kind: 'raw' }

// A table wider than this looks nothing like tabular data any more — likely
// a large, heterogeneous variable map that happened to be inside an array.
const MAX_TABLE_COLUMNS = 20

// Below this average per-column presence ratio, the objects don't share
// enough of a common shape to read as one table (see keyUniformity below).
const MIN_UNIFORMITY = 0.6

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Average, across every key that appears ANYWHERE in the array, of the
// fraction of rows that actually have that key. 1.0 means every row shares
// every key (fully uniform); values near 0 mean the objects are mostly
// disjoint. This tolerates a little raggedness (one row with an extra
// field) without accepting arrays that only coincidentally share a type.
function keyUniformity(keySets: string[][]): number {
  const allKeys = new Set(keySets.flat())
  if (allKeys.size === 0) return 0
  let total = 0
  for (const key of allKeys) {
    const present = keySets.filter((keys) => keys.includes(key)).length
    total += present / keySets.length
  }
  return total / allKeys.size
}

// How many levels of object-wrapping detectPayloadShape will look through to
// find a table-shaped array. Real activity outputs in this engine commonly
// wrap the actual data one or two levels deep — e.g. an HTTP Request node's
// logged output is `{"node_output": {"body": [...], "status_code": 200,
// "headers": {...}, ...}}`, confirmed live against a real execution — so a
// detector that only looks at the top-level value never finds the table a
// user actually wants for the single most common real node type in this
// feature. Bounded rather than unbounded: an arbitrarily deep search risks
// surfacing a coincidental array buried inside unrelated data as if it were
// "the" payload.
const MAX_UNWRAP_DEPTH = 2

// Only these wrapper keys are looked through. The engine's own activity
// results put their data under a small, known vocabulary (`node_output`, then
// HTTP Request's `body`, Fetch/Transform/Save Records' `records`, …). Any
// other key is ordinary data, not a wrapper: HTTP Request's logged INPUT is
// `{"configuration": {"url": …, "method": …, "headers": [{…}]}}`, and
// unwrapping through arbitrary keys surfaced that headers array as "the"
// table — silently hiding url/method, the part of the input that matters.
const CARRIER_KEYS = new Set(['node_output', 'output', 'body', 'records', 'items', 'data', 'rows', 'results'])

function tableFromArray(value: unknown): PayloadShape {
  if (!Array.isArray(value) || value.length === 0) return { kind: 'raw' }
  if (!value.every(isPlainRecord)) return { kind: 'raw' }

  const rows = value as Record<string, unknown>[]
  const keySets = rows.map((row) => Object.keys(row))
  // Preserve first-appearance order across rows rather than Set's insertion
  // order alone re-derived — same outcome, but reads clearly as "columns in
  // the order the data actually introduces them."
  const columns: string[] = []
  for (const keys of keySets) {
    for (const key of keys) {
      if (!columns.includes(key)) columns.push(key)
    }
  }

  if (columns.length === 0 || columns.length > MAX_TABLE_COLUMNS) return { kind: 'raw' }
  if (keyUniformity(keySets) < MIN_UNIFORMITY) return { kind: 'raw' }

  return { kind: 'table', columns, rows }
}

export function detectPayloadShape(value: unknown, depth = 0): PayloadShape {
  const direct = tableFromArray(value)
  if (direct.kind === 'table') return direct
  if (depth >= MAX_UNWRAP_DEPTH || !isPlainRecord(value)) return { kind: 'raw' }

  // Look for exactly one carrier field of this object whose OWN value is (or
  // contains) a table-shaped array. Requiring exactly one, not "the first
  // one found", avoids guessing wrong when an object genuinely has several
  // sibling arrays and there is no principled way to prefer one over
  // another — that case stays raw rather than risking a misleading pick.
  let candidate: PayloadShape | null = null
  let candidateCount = 0
  for (const [key, fieldValue] of Object.entries(value)) {
    if (!CARRIER_KEYS.has(key.toLowerCase())) continue
    const nested = detectPayloadShape(fieldValue, depth + 1)
    if (nested.kind === 'table') {
      candidate = nested
      candidateCount++
      if (candidateCount > 1) return { kind: 'raw' }
    }
  }
  return candidate ?? { kind: 'raw' }
}
