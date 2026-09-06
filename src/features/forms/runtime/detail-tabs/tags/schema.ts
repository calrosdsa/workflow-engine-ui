// The Tags tab has no configurable surface — same reasoning as
// attachments/schema.ts and comment/schema.ts.
export type TagsTabConfig = Record<string, never>

export function emptyTagsTabConfig(): TagsTabConfig {
  return {}
}

export function parseTagsTabConfig(): TagsTabConfig {
  return {}
}
