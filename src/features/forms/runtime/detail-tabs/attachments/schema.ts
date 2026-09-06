// The Attachments tab has no configurable surface — every form that adopts
// it gets the same record-scoped file list, no admin-authored variation.
// Mirrors comment/schema.ts's identical `{}` config shape.
export type AttachmentsTabConfig = Record<string, never>

export function emptyAttachmentsTabConfig(): AttachmentsTabConfig {
  return {}
}

export function parseAttachmentsTabConfig(): AttachmentsTabConfig {
  return {}
}
