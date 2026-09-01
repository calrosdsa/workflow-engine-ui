// ---------------------------------------------------------------------------
// ConfigSchema — the self-description every UI-registered type must carry
// ---------------------------------------------------------------------------
//
// The backend's /meta/catalog derives everything it can from Go registries by
// reflection, but menu types, custom actions, and detail tabs exist ONLY in
// this frontend's registries — the backend stores their config as opaque
// JSON and never parses it. So the catalog for these types is generated FROM
// these registries (src/lib/ui-catalog.ts) into a JSON file the backend
// embeds and serves.
//
// This type is what makes that generation drift-proof at the source: each
// registry contract requires a `configSchema`, so a new menu type, action, or
// tab CANNOT compile without describing its own config — the frontend twin
// of the backend's AST-scan catalog tests. Write the schema against the
// type's parseConfig/interface in the same folder; the two sit side by side
// precisely so a config change is one edit away from its description.
export interface ConfigSchema {
  type: 'object'
  description?: string
  required?: string[]
  properties?: Record<string, unknown>
  additionalProperties?: unknown
}
