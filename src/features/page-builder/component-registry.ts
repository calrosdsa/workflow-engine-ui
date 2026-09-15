// Direct mirror of features/form-builder/component-registry.ts's
// COMPONENT_REGISTRY, minus dataBearing/fieldType — no backend SQL
// projection exists for this feature since PageComponents are always
// presentational (see the Custom MenuType plan's non-goals).
//
// Every entry carries a configPanel — the same form/normalise pattern
// node-registry.ts and menu-registry.ts use — since all 6 PageComponentTypes
// are genuinely independent (no shared-tabs flow the way form-builder's 19
// data-bearing element types share ElementConfig), so full one-per-type
// dispatch is the right depth here, not a partial/optional field.
import type { ComponentType as ComponentTypeReact } from 'react'
import { Heading, Pilcrow, Image as ImageIcon, Minus, StretchVertical, Link2, type LucideIcon } from 'lucide-react'
import type { PageComponentType, PageComponentCategory } from './schema'
import {
  HeadingComponentForm, ParagraphComponentForm, ImageComponentForm,
  DividerComponentForm, SpacerComponentForm, ButtonComponentForm,
  type ComponentFormProps,
} from './config/ComponentForms'

export interface PageComponentRegistryEntry {
  type: PageComponentType
  /** Display-only reads (the toolbox, ComponentCard's badge/aria-label,
   *  ComponentPropertiesPanel's header, PageBuilderDnd's drag previews) go
   *  through `t(\`builder.pages.${type}.label\`)` instead of reading this
   *  directly — see Toolbox.tsx, the original call site this pattern is
   *  copied from. ONE exception: factory.ts's `createComponent('button')`
   *  reads `reg.label` directly to seed the new component's own PERSISTED
   *  `label` field — that seed must stay reading this untranslated literal
   *  (same reasoning as menu-registry.ts's `entry.label`; see that file's
   *  comment). Heading/paragraph's OWN persisted seeds (factory.ts's
   *  `base.text = 'Heading'`/`'Paragraph text...'`) are separate literals
   *  in factory.ts's switch, not derived from this registry at all — don't
   *  conflate the two when reasoning about what's safe to translate. */
  label: string
  icon: LucideIcon
  category: PageComponentCategory
  description: string
  /** Renders this type's property editor in ComponentPropertiesPanel.tsx. */
  configPanel: ComponentTypeReact<ComponentFormProps>
}

export const PAGE_COMPONENT_REGISTRY: Record<PageComponentType, PageComponentRegistryEntry> = {
  heading:   { type: 'heading',   label: 'Heading',     icon: Heading,         category: 'Text',   description: 'Section heading', configPanel: HeadingComponentForm },
  paragraph: { type: 'paragraph', label: 'Paragraph',   icon: Pilcrow,         category: 'Text',   description: 'Static text block', configPanel: ParagraphComponentForm },
  image:     { type: 'image',     label: 'Image',       icon: ImageIcon,       category: 'Media',  description: 'A static image', configPanel: ImageComponentForm },
  divider:   { type: 'divider',   label: 'Divider',     icon: Minus,           category: 'Layout', description: 'Horizontal line', configPanel: DividerComponentForm },
  spacer:    { type: 'spacer',    label: 'Spacer',      icon: StretchVertical, category: 'Layout', description: 'Vertical space', configPanel: SpacerComponentForm },
  button:    { type: 'button',    label: 'Button/Link', icon: Link2,           category: 'Action', description: 'A button that navigates somewhere', configPanel: ButtonComponentForm },
}

export const PAGE_COMPONENT_CATEGORIES: PageComponentCategory[] = ['Text', 'Media', 'Layout', 'Action']

export function pageComponentsByCategory(cat: PageComponentCategory): PageComponentRegistryEntry[] {
  return Object.values(PAGE_COMPONENT_REGISTRY).filter((c) => c.category === cat)
}
