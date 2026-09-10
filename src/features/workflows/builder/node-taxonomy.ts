// ---------------------------------------------------------------------------
// How workflow nodes are GROUPED — served, not hardcoded
// ---------------------------------------------------------------------------
//
// Two axes decide where a node appears in the palette, and until this module
// existed neither was modelled:
//
//   kind      where the implementation lives: core (compiled into the
//             engine) or package (contributed by an internally-authored
//             package, internal/noderegistry — either a declarative node or
//             a dialed connector-sdk process, indistinguishable from here).
//             This was once INFERRED — "not in NODE_REGISTRY, so it must be
//             a connector" — which is why a non-built-in node type had
//             nowhere to go until this module existed.
//
//   category  what the node does. Three vocabularies existed at once: Go's
//             (structure/data/logic/io/ai/output), this file's predecessor in
//             node-registry.ts (Data/Logic/Integrations/Notify/Knowledge/
//             Debug/Agent), and a free-form string on every connector manifest
//             that no consumer read at all.
//
// The vocabulary now lives in Go (internal/graph's categoryCatalog) and is
// SERVED. This module fetches it. What stays compiled in is presentation for
// a CORE node — icon, colour, config form — because that genuinely cannot be
// served for something already part of this bundle. A PACKAGE node has no
// such bundle to compile into, so its own presentation data (display name,
// icon hint, config/output schema) travels in the SAME response, on the same
// per-node entries below — see NodeTaxonomyEntry's own doc comment.
//
// The practical consequence, which is the point: adding a category is one row
// in internal/graph/catalog.go. No frontend change, no rebuild, no drift.
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { JSONSchema } from './SchemaForm'

/** Provenance. Mirrors graph.NodeKind's two PRODUCED values — 'connector'
 *  and 'template' predate the package system and no deployment serves them
 *  any more (see graph.NodeKind's own never-remove-from-the-wire doc
 *  comment for why the Go constants still exist), so this union does not
 *  carry them either. */
export type NodeKind = 'core' | 'package'

/** One category as the backend describes it. Mirrors graph.CategoryInfo
 *  field-for-field so there is no translation layer to keep in sync. */
export interface CategoryInfo {
  id: string
  label: string
  description: string
  order: number
}

/** One node type's grouping, plus — for a package entry only — everything
 *  needed to render one: this build has no compiled-in form for a package
 *  type, so unlike a core entry (whose schema stays compiled in and absent
 *  here), a package entry's display name, icon hint, and config/output
 *  schema travel on the SAME response, on the same object. Mirrors
 *  api/meta's NodeTaxonomyEntry field-for-field — see that type's own doc
 *  comment for why a core entry never sets the last five fields. */
export interface NodeTaxonomyEntry {
  type: string
  kind: NodeKind
  category: string
  deprecated?: boolean
  summary?: string
  display_name?: string
  icon_hint?: string
  config_schema?: JSONSchema
  output_schema?: JSONSchema
}

/** Looks up one package node's full descriptor (schema included) by type.
 *  undefined for a core type, a type this build has never heard of, or
 *  before the taxonomy has loaded — every case a caller treats the same way:
 *  fall back to whatever it shows for an unregistered node. */
export function findPackageNode(taxonomy: NodeTaxonomy | undefined, type: string): NodeTaxonomyEntry | undefined {
  return taxonomy?.nodes.find((n) => n.type === type && n.kind === 'package')
}

export interface NodeTaxonomy {
  categories: CategoryInfo[]
  kinds: { value: string; description?: string }[]
  nodes: NodeTaxonomyEntry[]
}

// The vocabulary as of the build this bundle was cut from, used ONLY until
// the fetch lands and if the backend predates /meta/node-taxonomy.
//
// This is a cache, not a second source of truth — the distinction matters. It
// supplies labels and ordering until the server answers; from then on the
// server wins entirely, and a category present there but absent here still
// renders (see categoryLabel/categoryOrder, which fall back to the id itself
// rather than dropping the group). That is what stops this list from quietly
// becoming the parallel hand-maintained copy it replaced.
const FALLBACK_CATEGORIES: CategoryInfo[] = [
  { id: 'structure',   label: 'Structure',   description: 'Graph plumbing.',                       order: 10 },
  { id: 'data',        label: 'Data',        description: 'Records on this app own forms.',        order: 20 },
  { id: 'logic',       label: 'Logic',       description: 'Branching, variables, reshaping.',      order: 30 },
  { id: 'integration', label: 'Integration', description: 'Calling systems outside the platform.', order: 40 },
  { id: 'ai',          label: 'AI',          description: 'Knowledge bases and agents.',           order: 50 },
  { id: 'notify',      label: 'Notify',      description: 'Telling a person something.',           order: 60 },
  { id: 'output',      label: 'Output',      description: 'Producing an artifact.',                order: 70 },
  { id: 'utility',     label: 'Utility',     description: 'Small self-contained computations.',    order: 80 },
]

export const taxonomyKeys = {
  all: () => ['workflows', 'node-taxonomy'] as const,
}

const EMPTY_TAXONOMY: NodeTaxonomy = { categories: FALLBACK_CATEGORIES, kinds: [], nodes: [] }

async function fetchTaxonomy(): Promise<NodeTaxonomy> {
  try {
    return await api.get('meta/node-taxonomy').json<NodeTaxonomy>()
  } catch {
    // A backend older than this endpoint is a real deployment state, not an
    // error worth surfacing: the palette still works off compiled-in
    // categories, it just cannot learn about new ones. Failing the query
    // instead would render an empty palette, which is strictly worse than a
    // slightly stale one.
    return EMPTY_TAXONOMY
  }
}

/** Placeholder is the fallback vocabulary rather than undefined, so callers
 *  need no isLoading branch. */
export function useNodeTaxonomy() {
  return useQuery({
    queryKey: taxonomyKeys.all(),
    queryFn: fetchTaxonomy,
    placeholderData: EMPTY_TAXONOMY,
    staleTime: 5 * 60 * 1000,
  })
}

/** Human label for a category id. An id the server sent but this build has
 *  no label for renders as the id itself — visibly odd, but present and
 *  selectable, which beats silently swallowing every node in it. */
export function categoryLabel(id: string, categories: CategoryInfo[]): string {
  return categories.find((c) => c.id === id)?.label
    ?? FALLBACK_CATEGORIES.find((c) => c.id === id)?.label
    ?? id
}

function categoryOrder(id: string, categories: CategoryInfo[]): number {
  const known = categories.find((c) => c.id === id)?.order
    ?? FALLBACK_CATEGORIES.find((c) => c.id === id)?.order
  // An unknown category sorts after every known one rather than before, so a
  // node type this build has never heard of cannot displace the familiar
  // groups from the front of the palette.
  return known ?? Number.MAX_SAFE_INTEGER
}

/** One palette entry, whatever its provenance. iconHint is set only for a
 *  package entry — a core entry resolves its icon from NODE_REGISTRY instead
 *  (see icon-hints.ts's iconFor, which checks both). */
export interface PaletteEntry {
  type: string
  kind: NodeKind
  category: string
  label: string
  description: string
  iconHint?: string
}

export interface PaletteGroup {
  id: string
  label: string
  entries: PaletteEntry[]
}

/** Groups entries into ordered, NON-EMPTY category groups.
 *
 *  Empty groups are dropped rather than rendered, which is what lets the
 *  vocabulary reserve a name ahead of the nodes that will fill it ('utility'
 *  ships with no members today, for declarative package nodes) without
 *  showing an empty tab.
 *
 *  Within a group, core nodes come first. That is the concession to the
 *  concern the old separate-Connectors-tab design was protecting: grouping by
 *  function means a package node now shares a tab with built-ins, but it can
 *  never push one of them out of its familiar position. */
export function groupByCategory(entries: PaletteEntry[], categories: CategoryInfo[]): PaletteGroup[] {
  const byCategory = new Map<string, PaletteEntry[]>()
  for (const entry of entries) {
    const list = byCategory.get(entry.category)
    if (list) list.push(entry)
    else byCategory.set(entry.category, [entry])
  }

  const kindRank = (k: NodeKind) => (k === 'core' ? 0 : 1)

  return [...byCategory.entries()]
    .map(([id, list]) => ({
      id,
      label: categoryLabel(id, categories),
      // Stable within a rank: the incoming order is the authored palette
      // order, which is deliberate (rough authoring frequency, not
      // alphabetical), so only the core/non-core split is imposed here.
      entries: [...list].sort((a, b) => kindRank(a.kind) - kindRank(b.kind)),
    }))
    .sort((a, b) => categoryOrder(a.id, categories) - categoryOrder(b.id, categories))
}
