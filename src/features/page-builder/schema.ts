// ---------------------------------------------------------------------------
// Page Builder schema
// ---------------------------------------------------------------------------
//
// Structural analog of features/form-builder/schema.ts's FormSchema, trimmed
// to presentational-only components — no validation/behavior/binding, since
// PageComponents never carry data or conditional visibility (see the Custom
// MenuType plan's v1 scope decision). Stored verbatim inside a Custom menu's
// config.schema (see features/menus/types.ts's CustomMenuConfig), opaque to
// the backend exactly like FormSchema is opaque inside form_definitions.layout.
//
// Hierarchy: PageSchema → PageSection[] → PageColumn[] → PageComponent[]
//
// Re-exports ColumnLayout/COLUMN_LAYOUTS from form-builder rather than
// duplicating — pure layout math with zero form-specific coupling, and a
// second copy would risk the two drifting (e.g. a '5' layout added to one
// and not the other).
export type { ColumnLayout } from '@/features/form-builder/schema'
export { COLUMN_LAYOUTS } from '@/features/form-builder/schema'
import type { ColumnLayout } from '@/features/form-builder/schema'

export type PageComponentType = 'heading' | 'paragraph' | 'image' | 'divider' | 'spacer' | 'button'

export type PageComponentCategory = 'Text' | 'Media' | 'Layout' | 'Action'

export interface PageComponent {
  id: string
  component: PageComponentType

  // heading / paragraph
  text?: string
  level?: 1 | 2 | 3          // heading only

  // image (URL-entry fallback — no upload backend, matches FieldRenderer.tsx's
  // existing documented gap for the form-builder's own image component)
  src?: string
  alt?: string
  width?: 'full' | 'half' | 'third' | 'auto'

  // spacer
  height?: number             // px

  // button (dual-mode: navigate to another menu by slug, or an external URL)
  label?: string
  linkType?: 'menu' | 'external'
  menuSlug?: string
  url?: string
  variant?: 'primary' | 'secondary' | 'outline'
}

export interface PageColumn {
  id: string
  ratio: number
  components: PageComponent[]
}

export interface PageSection {
  id: string
  title: string
  layout: ColumnLayout
  columns: PageColumn[]
  collapsed?: boolean
}

export interface PageSchema {
  version: 1
  sections: PageSection[]
}

export function emptyPageSchema(): PageSchema {
  return { version: 1, sections: [] }
}
