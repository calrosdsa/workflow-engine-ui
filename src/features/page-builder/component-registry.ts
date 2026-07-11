// Direct mirror of features/form-builder/component-registry.ts's
// COMPONENT_REGISTRY, minus dataBearing/fieldType — no backend SQL
// projection exists for this feature since PageComponents are always
// presentational (see the Custom MenuType plan's non-goals).
import { Heading, Pilcrow, Image as ImageIcon, Minus, StretchVertical, Link2, type LucideIcon } from 'lucide-react'
import type { PageComponentType, PageComponentCategory } from './schema'

export interface PageComponentRegistryEntry {
  type: PageComponentType
  label: string
  icon: LucideIcon
  category: PageComponentCategory
  description: string
}

export const PAGE_COMPONENT_REGISTRY: Record<PageComponentType, PageComponentRegistryEntry> = {
  heading:   { type: 'heading',   label: 'Heading',     icon: Heading,         category: 'Text',   description: 'Section heading' },
  paragraph: { type: 'paragraph', label: 'Paragraph',   icon: Pilcrow,         category: 'Text',   description: 'Static text block' },
  image:     { type: 'image',     label: 'Image',       icon: ImageIcon,       category: 'Media',  description: 'A static image' },
  divider:   { type: 'divider',   label: 'Divider',     icon: Minus,           category: 'Layout', description: 'Horizontal line' },
  spacer:    { type: 'spacer',    label: 'Spacer',      icon: StretchVertical, category: 'Layout', description: 'Vertical space' },
  button:    { type: 'button',    label: 'Button/Link', icon: Link2,           category: 'Action', description: 'A button that navigates somewhere' },
}

export const PAGE_COMPONENT_CATEGORIES: PageComponentCategory[] = ['Text', 'Media', 'Layout', 'Action']

export function pageComponentsByCategory(cat: PageComponentCategory): PageComponentRegistryEntry[] {
  return Object.values(PAGE_COMPONENT_REGISTRY).filter((c) => c.category === cat)
}
