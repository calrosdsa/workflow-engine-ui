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
import { Search, PlusSquare, FolderTree, LayoutTemplate, LayoutDashboard, Code2, LayoutGrid, type LucideIcon } from 'lucide-react'
import type { ConfigSchema } from '@/lib/config-schema'
import type { Menu, MenuType } from './types'
import type { FilterGroup } from '@/features/workflows/types'
import { SearchMenuConfigPanel } from './config-panels/SearchMenuConfigPanel'
import { AddMenuConfigPanel } from './config-panels/AddMenuConfigPanel'
import { ParentMenuConfigPanel } from './config-panels/ParentMenuConfigPanel'
import { CustomMenuConfigPanel } from './config-panels/CustomMenuConfigPanel'
import { DashboardMenuConfigPanel } from './config-panels/DashboardMenuConfigPanel'
import { HtmlMenuConfigPanel } from './config-panels/HtmlMenuConfigPanel'
import { SearchMenuRuntime } from './runtime/SearchMenuRuntime'
import { AddMenuRuntime } from './runtime/AddMenuRuntime'
import { ParentMenuRuntime } from './runtime/ParentMenuRuntime'
import { CustomMenuRuntime } from './runtime/CustomMenuRuntime'
import { DashboardMenuRuntime } from './runtime/DashboardMenuRuntime'
import { HtmlMenuRuntime } from './runtime/HtmlMenuRuntime'
import { emptyPageSchema } from '@/features/page-builder/schema'
import { emptyDashboardSchema } from '@/features/dashboard/schema'
// Side-effecting: registers every built-in widget plugin (widgets/index.ts)
// at module load. This file is the shared dependency both the builder
// bundle (main.tsx) and the runtime bundle (runtime-main.tsx) already import
// in order to resolve the 'dashboard' menu type below, so importing it here
// — rather than from each entry point separately — guarantees the widget
// registry is populated before any dashboard is ever rendered, in both
// bundles, without relying on remembering to wire up a third entry point
// later. See widget-registry.ts's load-order note for why this ordering
// matters.
import '@/features/dashboard/widgets'

export interface MenuConfigPanelProps {
  menu: Menu
  onChange: (config: Menu['config']) => void
  /** The current app's ID — most config panels don't need it (they operate
   *  purely on `menu.config`), but the Dashboard type's config panel wires
   *  in widget Renderers/ConfigPanels that DO need a real appId (table/chart
   *  widgets scoping form lookups, the embed widget's SSO handshake). */
  appId: string
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
  /** An extra filter condition to AND onto this menu's own filter, sourced
   *  from a connections tile's ?linkField=/?linkValue= navigation (see
   *  runtime-router.tsx's runtimeMenuRoute) — a record-detail tile
   *  redirecting to "this form's list, but only the records linked to the
   *  record I came from." SearchMenuRuntime is the only renderer that reads
   *  this today; every other menu type ignores it, the same "optional,
   *  type-specific, safe to ignore" convention onEmptyResolved/groupDepth
   *  already use on DetailTabRendererProps. */
  externalFilter?: FilterGroup
}

export interface MenuTypeRegistryEntry {
  type: MenuType
  label: string
  icon: LucideIcon
  description: string
  category: 'Navigation' | 'Data'
  /** JSON Schema for this type's `config` object, exported to the backend's
   *  /meta/catalog via src/lib/ui-catalog.ts — this registry is the ONLY
   *  place menu config shapes are described, replacing the hand-written
   *  copy the backend used to carry. Required so a new menu type cannot
   *  compile without describing itself (see ConfigSchema's doc comment).
   *  Keep it aligned with the matching *MenuConfig interface in types.ts. */
  configSchema: ConfigSchema
  /** Retirement policy (workflow-engine/COMPATIBILITY.md): a retired type
   *  keeps rendering forever but stops being offered for NEW configuration.
   *  Set deprecated (and replacedBy, naming the live type to use instead)
   *  rather than ever deleting a registration — stored configs reference
   *  types by name, and a deleted registration turns every one of them into
   *  an unrenderable unknown. Flows into the generated ui-catalog. */
  deprecated?: boolean
  replacedBy?: string
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
    configSchema: {
      type: 'object',
      description: 'A filterable, sortable, paginated list of one form’s records. Creating one in the builder normally also creates a paired hidden ‘add’ menu reached from its Create button.',
      required: ['form_id', 'columns', 'page_size'],
      properties: {
        form_id: { type: 'string', description: 'Id of the form whose records this menu lists.' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Field names to show as columns, in order.' },
        default_filter: { type: 'object', description: 'A FilterGroup applied before the user’s own filters. Same filter grammar as workflow nodes.' },
        default_sort: { type: 'array', items: { type: 'object' }, description: 'SortRule list applied by default.' },
        page_size: { type: 'integer', description: 'Rows per page.' },
      },
    },
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
    configSchema: {
      type: 'object',
      description: 'A create form for one form’s records. Often hidden from the nav and reached only from a paired ‘search’ menu’s Create button.',
      required: ['form_id', 'success_behavior'],
      properties: {
        form_id: { type: 'string', description: 'Id of the form being created.' },
        success_behavior: { type: 'string', enum: ['message', 'redirect'], description: 'What happens after a successful save.' },
        success_message: { type: 'string', description: 'Shown when success_behavior is ‘message’.' },
        redirect_menu_slug: { type: 'string', description: 'Menu slug to navigate to when success_behavior is ‘redirect’.' },
      },
    },
    configPanel: AddMenuConfigPanel,
    runtimeRenderer: AddMenuRuntime,
    createDefaultConfig: () => ({ form_id: '', success_behavior: 'message' }),
  },
  parent: {
    type: 'parent',
    label: 'Group',
    icon: FolderTree,
    description: 'A navigation container for other menus',
    category: 'Navigation',
    configSchema: {
      type: 'object',
      description: 'A grouping node in the navigation tree. Renders its child menus rather than content of its own.',
      properties: {
        collapsed_by_default: { type: 'boolean', description: 'Whether the group starts collapsed in the sidebar.' },
      },
    },
    configPanel: ParentMenuConfigPanel,
    runtimeRenderer: ParentMenuRuntime,
    createDefaultConfig: () => ({}),
  },
  module: {
    type: 'module',
    label: 'Module',
    icon: LayoutGrid,
    description: 'A Workspace launcher tile shown on the app’s home page. Can only be nested at the top level or under another Module — never under a Group or any other menu type. Any other menu type can be nested under a Module to give it its own sidebar contents.',
    category: 'Navigation',
    configSchema: {
      type: 'object',
      description: 'A grouping/launcher node, structurally identical to a Group menu’s config. Renders as a home-page tile at the top level, or as a scoped-sidebar row when nested under another Module.',
      properties: {
        collapsed_by_default: { type: 'boolean', description: 'Whether this module starts collapsed when it appears as a row inside another module’s scoped sidebar.' },
      },
    },
    configPanel: ParentMenuConfigPanel,
    runtimeRenderer: ParentMenuRuntime,
    createDefaultConfig: () => ({}),
  },
  custom: {
    type: 'custom',
    label: 'Custom Page',
    icon: LayoutTemplate,
    description: 'Retired — use an HTML Page instead. Existing Custom Pages keep working.',
    category: 'Data',
    // Retired, NOT removed (COMPATIBILITY.md rule 3): the registration has
    // to stay or every stored custom-menu config becomes an unrenderable
    // unknown. The flag stops it being offered for new menus; the renderer
    // below keeps serving the ones that already exist, indefinitely.
    deprecated: true,
    replacedBy: 'html',
    configSchema: {
      type: 'object',
      description: '‘mode’ selects which of schema/embedUrl is active. Switching modes in the builder leaves the other populated rather than clearing it.',
      required: ['mode'],
      properties: {
        mode: { type: 'string', enum: ['page', 'embed'] },
        schema: { type: 'object', description: 'PageSchema, used when mode is ‘page’. Opaque to the backend.' },
        embedUrl: { type: 'string', description: 'URL to iframe, used when mode is ‘embed’.' },
        integrationId: { type: 'string', description: 'Optional signed_launch Embedded Integration to authenticate the embed. Unset means a plain unauthenticated iframe.' },
      },
    },
    configPanel: CustomMenuConfigPanel,
    runtimeRenderer: CustomMenuRuntime,
    createDefaultConfig: () => ({ mode: 'page', schema: emptyPageSchema() }),
  },
  dashboard: {
    type: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'A grid of charts, tables, and other widgets — also usable as a custom page',
    category: 'Data',
    configSchema: {
      type: 'object',
      description: 'A canvas holding only content widgets (heading, paragraph, image) is a page — pages and dashboards share one model rather than being two features.',
      required: ['schema'],
      properties: {
        schema: { type: 'object', description: 'DashboardSchema — the widget grid. Authored against this catalog’s `dashboards` section: dashboards.envelope for this object’s shape, dashboards.widget_envelope for each tile, dashboards.widgets for every widget type and its config.' },
      },
    },
    configPanel: DashboardMenuConfigPanel,
    runtimeRenderer: DashboardMenuRuntime,
    createDefaultConfig: () => ({ schema: emptyDashboardSchema() }),
  },
  html: {
    type: 'html',
    label: 'HTML Page',
    icon: Code2,
    description: 'An author-written HTML page, sandboxed, that can read and write form records',
    category: 'Data',
    configSchema: {
      type: 'object',
      description:
        'An author-written HTML page rendered in a sandboxed iframe (no same-origin access). Scripts run, but reach the platform only through data sources and write targets declared here, and the network only through allowed_hosts. The app theme is injected as CSS custom properties, so hsl(var(--primary)) matches the runtime.',
      required: ['html', 'data_sources', 'write_targets', 'allowed_hosts'],
      properties: {
        html: { type: 'string', description: 'The page markup, stored verbatim and never sanitized — the sandbox is the boundary.' },
        data_sources: {
          type: 'array',
          description: 'Queries the page may run, addressed by id via AppBuilder.query(id). A page cannot read a form that is not declared here.',
          items: {
            type: 'object',
            required: ['id', 'form_id'],
            properties: {
              id: { type: 'string', description: 'Author-chosen id the page passes to AppBuilder.query().' },
              form_id: { type: 'string', description: 'Id of the form to read.' },
              filter: { type: 'object', description: 'A FilterGroup applied server-side. Same grammar as workflow nodes.' },
              sort: { type: 'array', items: { type: 'object' }, description: 'SortRule list.' },
              columns: { type: 'array', items: { type: 'string' }, description: 'Field names to return. Empty returns every field. `id` is always included.' },
              page_size: { type: 'integer', description: 'Default rows per request. Capped at 500.' },
            },
          },
        },
        write_targets: {
          type: 'array',
          description: 'Forms the page may write to via AppBuilder.write(). Writes run as the viewer, through the ordinary record endpoints, so the viewer’s own permissions, validation, triggers and audit all apply.',
          items: {
            type: 'object',
            required: ['id', 'form_id'],
            properties: {
              id: { type: 'string', description: 'Author-chosen id the page passes to AppBuilder.write().' },
              form_id: { type: 'string', description: 'Id of the form to write.' },
              allow_create: { type: 'boolean', description: 'Permit creating records.' },
              allow_update: { type: 'boolean', description: 'Permit updating existing records.' },
            },
          },
        },
        allowed_hosts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Hosts the page may reach outward, enforced by a CSP composed into the frame. Empty means no outbound requests at all.',
        },
      },
    },
    configPanel: HtmlMenuConfigPanel,
    runtimeRenderer: HtmlMenuRuntime,
    createDefaultConfig: () => ({ html: '', data_sources: [], write_targets: [], allowed_hosts: [] }),
  },
}

export function menuTypesByCategory(cat: MenuTypeRegistryEntry['category']): MenuTypeRegistryEntry[] {
  return Object.values(MENU_TYPE_REGISTRY).filter((m) => m.category === cat)
}

/** The safe way to resolve a menu type, and the structural analog of the widget
 *  registry's getWidget().
 *
 *  Deliberately keyed on `string`, not `MenuType`: the types that actually reach
 *  this registry arrive as JSON from the published snapshot, and that fetch
 *  (`.json<AppSnapshot>()`) is a compile-time assertion with no runtime schema
 *  check. Indexing MENU_TYPE_REGISTRY directly types every lookup as
 *  unconditionally present — TypeScript assumes a `Record<ClosedUnion, T>` has
 *  every key — so an out-of-registry `menu_type` yields undefined and throws on
 *  the very next property access, with no error boundary anywhere to catch it.
 *  Returning `T | undefined` is what forces each caller to handle the miss.
 *  See FR-D1-008. */
export function getMenuType(type: string): MenuTypeRegistryEntry | undefined {
  return (MENU_TYPE_REGISTRY as Record<string, MenuTypeRegistryEntry>)[type]
}
