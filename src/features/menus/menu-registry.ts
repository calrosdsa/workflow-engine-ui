// The MenuType registry — direct structural analog of
// features/form-builder/component-registry.ts's COMPONENT_REGISTRY, extended
// with configPanel/runtimeRenderer/createDefaultConfig because unlike form
// elements (builder-side rendering only), menus need BOTH a builder config UI
// AND a completely separate end-user runtime UI.
//
// Adding a new menu type (e.g. Dashboard) means: add a config-panel
// component, add a runtime-renderer component, add one entry to
// MENU_TYPE_REGISTRY. Zero edits to search/add/parent's files, zero edits to
// anything that reads this registry generically (MenusSection.tsx,
// RuntimeSidebar.tsx, buildMenuTree) — none of them switch on menu_type
// themselves, they all delegate to this registry.
import type { ComponentType } from 'react'
import { Search, PlusSquare, FolderTree, LayoutTemplate, type LucideIcon } from 'lucide-react'
import type { Menu, MenuType } from './types'
import { SearchMenuConfigPanel } from './config-panels/SearchMenuConfigPanel'
import { AddMenuConfigPanel } from './config-panels/AddMenuConfigPanel'
import { ParentMenuConfigPanel } from './config-panels/ParentMenuConfigPanel'
import { CustomMenuConfigPanel } from './config-panels/CustomMenuConfigPanel'
import { SearchMenuRuntime } from './runtime/SearchMenuRuntime'
import { AddMenuRuntime } from './runtime/AddMenuRuntime'
import { ParentMenuRuntime } from './runtime/ParentMenuRuntime'
import { CustomMenuRuntime } from './runtime/CustomMenuRuntime'
import { emptyPageSchema } from '@/features/page-builder/schema'

export interface MenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
}

export interface MenuRuntimeRendererProps {
  menu: Menu
  clientId: string
  appId: string
  /** The full sibling menu list for this app (from the published snapshot),
   *  available to any renderer that needs cross-menu context — e.g. Parent
   *  menu resolving its children, or a future Dashboard menu type linking
   *  to other sections. Not required to be used. */
  menus?: Menu[]
  /** Navigate to another menu by slug, when the renderer wants app-internal
   *  navigation (e.g. a Parent menu's child-picker cards, or Add menu's
   *  "redirect after save"). Not required to be used. */
  onNavigate?: (slug: string) => void
}

export interface MenuTypeRegistryEntry {
  type: MenuType
  label: string
  icon: LucideIcon
  description: string
  category: 'Navigation' | 'Data'
  /** Renders the type-specific property panel in the menu builder. */
  configPanel: ComponentType<MenuConfigPanelProps>
  /** Renders the actual end-user-facing content at runtime for this menu type. */
  runtimeRenderer: ComponentType<MenuRuntimeRendererProps>
  /** Produces a valid default `config` for a freshly created menu of this type. */
  createDefaultConfig: () => Menu['config']
}

export const MENU_TYPE_REGISTRY: Record<MenuType, MenuTypeRegistryEntry> = {
  search: {
    type: 'search',
    label: 'Search',
    icon: Search,
    description: 'Lists and searches records from a form',
    category: 'Data',
    configPanel: SearchMenuConfigPanel,
    runtimeRenderer: SearchMenuRuntime,
    createDefaultConfig: () => ({ form_id: '', columns: [], page_size: 25 }),
  },
  add: {
    type: 'add',
    label: 'Add',
    icon: PlusSquare,
    description: 'A form for creating a new record',
    category: 'Data',
    configPanel: AddMenuConfigPanel,
    runtimeRenderer: AddMenuRuntime,
    createDefaultConfig: () => ({ form_id: '', success_behavior: 'message', navigate_after_save: false }),
  },
  parent: {
    type: 'parent',
    label: 'Group',
    icon: FolderTree,
    description: 'A navigation container for other menus',
    category: 'Navigation',
    configPanel: ParentMenuConfigPanel,
    runtimeRenderer: ParentMenuRuntime,
    createDefaultConfig: () => ({}),
  },
  custom: {
    type: 'custom',
    label: 'Custom Page',
    icon: LayoutTemplate,
    description: 'A custom-designed content page, or an embedded external webpage',
    category: 'Data',
    configPanel: CustomMenuConfigPanel,
    runtimeRenderer: CustomMenuRuntime,
    createDefaultConfig: () => ({ mode: 'page', schema: emptyPageSchema() }),
  },
}

export function menuTypesByCategory(cat: MenuTypeRegistryEntry['category']): MenuTypeRegistryEntry[] {
  return Object.values(MENU_TYPE_REGISTRY).filter((m) => m.category === cat)
}
