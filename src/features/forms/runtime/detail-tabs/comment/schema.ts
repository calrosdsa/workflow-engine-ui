// FR-D2-016 — the comment tab type has no configurable surface (§3: "every
// form that adopts this tab type gets the same comment thread, no
// admin-authored variation"). config is `{}`, kept as a real type rather
// than `unknown` for symmetry with every other DetailTabDefinition, whose
// parseConfig/createDefaultConfig this still has to implement.
export type CommentTabConfig = Record<string, never>

export function emptyCommentTabConfig(): CommentTabConfig {
  return {}
}

export function parseCommentTabConfig(): CommentTabConfig {
  return {}
}
