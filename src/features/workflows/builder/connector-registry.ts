// Runtime-fetched counterpart to node-registry.ts's compile-time
// NODE_REGISTRY — see the connector architecture plan §06 for the full
// design. A connector isn't compiled into this bundle (that's the whole
// point of the pluggable-connector system: adding one requires no frontend
// rebuild), so its palette entry and config form can't live as a
// `Record<NodeType, NodeRegistryEntry>` key the way every built-in node
// type's does. This module is the parallel runtime path: fetched once per
// app-load from GET /api/connectors (a thin proxy over the in-memory
// registry workflow-engine already built at startup — no gRPC call per
// frontend request), rendered through a generic JSON-Schema-driven form
// (SchemaForm.tsx) rather than a compiled-in React component reference.
//
// node-registry.ts's NodeType union and NODE_REGISTRY stay UNTOUCHED by
// this module — every call site that needs to look up a node type that
// might be connector-sourced (NodeConfigPanel, NodePalette,
// NodePickerModal, Layout.tsx's nodeTypes map) does its own two-step
// lookup: NODE_REGISTRY first (built-ins, zero behavior change), this
// registry as the fallback.

import type { JSONSchema } from './SchemaForm'
import type { NodeKind } from './node-taxonomy'

/** Mirrors api/connectors/handler.go's manifestResponse wire shape exactly
 *  — field-for-field, not renamed, so there's no translation layer to keep
 *  in sync with the backend's own JSON tags. */
export interface ConnectorManifest {
  type: string
  /** Provenance, stated by the backend rather than inferred here: a gRPC
   *  connector process or a declarative node template. Both publish their own
   *  config schema and both render through SchemaForm, which is why they share
   *  this shape — but the palette badges them differently, and only a template
   *  is fully described by data this deployment holds. */
  kind: NodeKind
  config_schema_version: number
  display_name: string
  description: string
  category: string
  config_json_schema: JSONSchema
  output_json_schema?: JSONSchema
  icon_hint?: string
}

/** The shape every call site actually wants — node-registry.ts's
 *  NodeRegistryEntry has label/category/description as top-level fields,
 *  not nested under a manifest; this is the same flattening, applied to a
 *  connector manifest instead. `type` is deliberately `string`, not
 *  `NodeType` — see this file's header comment for why NodeType itself
 *  must stay closed. */
export interface ConnectorRegistryEntry {
  type: string
  kind: NodeKind
  label: string
  description: string
  category: string
  configSchema: JSONSchema
  outputSchema?: JSONSchema
  iconHint?: string
  configSchemaVersion: number
}

export function toRegistryEntry(m: ConnectorManifest): ConnectorRegistryEntry {
  return {
    type: m.type,
    // Older backends predate the field; treating an absent kind as
    // 'connector' is right because that is the only thing this endpoint could
    // have been serving before templates existed.
    kind: m.kind ?? 'connector',
    label: m.display_name || m.type,
    description: m.description,
    // Already normalized against the shared vocabulary server-side
    // (graph.NormalizeCategory), so this is a defensive default for an older
    // backend, not a translation.
    category: m.category || 'integration',
    configSchema: m.config_json_schema,
    outputSchema: m.output_json_schema,
    iconHint: m.icon_hint,
    configSchemaVersion: m.config_schema_version,
  }
}
