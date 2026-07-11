// Mirror of features/form-builder/serialize.ts's parseLayout — a defensive
// normalizer, not a full bridge layer. Unlike FormDefinition.layout (an
// opaque JSON blob needing its own parse from a string), CustomMenuConfig's
// schema field is already typed PageSchema on the wire, so this only guards
// against unexpected/legacy shapes (e.g. {} from a menu created before this
// schema stabilized). No projection.ts analog — nothing in PageSchema is
// data-bearing, so there's no SQL field derivation step.
import { type PageSchema, emptyPageSchema } from './schema'

export function parsePageSchema(raw: unknown): PageSchema {
  if (!raw) return emptyPageSchema()
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj && typeof obj === 'object' && Array.isArray((obj as PageSchema).sections)) {
      return { version: 1, sections: (obj as PageSchema).sections }
    }
  } catch {
    // fall through
  }
  return emptyPageSchema()
}
