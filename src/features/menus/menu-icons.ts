// The icon vocabulary a menu may choose from.
//
// `Menu.icon` has always existed on the type, on the API (api/menus's
// `Icon *string`) and in the database — it was simply never settable, and
// both the builder tree and the runtime sidebar rendered
// MENU_TYPE_REGISTRY[menu_type].icon instead. This module supplies the
// missing half: a name→component resolver plus the catalog the picker
// renders.
//
// WHY A CURATED LIST, PLUS A DYNAMIC FALLBACK
// -------------------------------------------
// This module hand-picks ~115 of lucide's ~2,000 icons — the ones that read
// as navigation at 14px, grouped the way someone naming a menu would look
// for them — and that curated set is the PICKER's whole world: a browsable
// grid, eagerly bundled (named imports, not `import * as`, so it tree-shakes
// like any other), resolved synchronously via resolveMenuIcon() so a menu
// row never flashes a fallback before its real icon appears.
//
// But the picker is not the only writer of `Menu.icon` — most menus in a
// real app are authored through the app-builder API (an MCP tool, a
// workflow, a script), which accepts any of lucide's real icon names, not
// only these ~115. resolveMenuIcon() only ever covers the curated set;
// MenuIcon.tsx covers the rest by falling through to lucide-react's own
// `lucide-react/dynamic` entry point (dynamicIconImports + DynamicIcon),
// which code-splits every icon into its own tiny chunk fetched on first use.
// Supporting the full catalog this way costs nothing until a menu actually
// names one of those icons, and the runtime bundle stays exactly as small as
// it was when this file only knew ~115 names — see MenuIcon.tsx.
//
// Icon names round-trip as lucide's own kebab-case identifiers (`id-card`,
// not `IdCard`) — that's what dynamicIconImports is keyed by, what
// lucide.dev calls the icon, and what the auto-generated CSS class
// (`lucide-id-card`) already reveals. A menu built before this file's
// catalog switched to writing that convention may still carry the old
// PascalCase spelling; toKebabIconName() below is the one seam every lookup
// goes through so either spelling resolves to the same icon, keeping a name
// portable to any other client rendering the same menu (the KMP mobile
// runtime included) regardless of which era wrote it.
//
// Adding a curated entry is a two-line change: import it, and add it to a
// group's `icons` array.

import { dynamicIconImports, type IconName } from 'lucide-react/dynamic'
import {
  // General / navigation
  Home, LayoutDashboard, LayoutGrid, LayoutList, Menu as MenuIcon, Compass,
  Star, Heart, Bookmark, Flag, Pin, Sparkles, Zap, Rocket,
  // Data / records
  Database, Table2, List, ListChecks, ListOrdered, Rows3, Columns3,
  FileText, Files, FolderOpen, Folder, Archive, Inbox, Package, Boxes,
  // Search / filter
  Search, Filter, SlidersHorizontal, ScanLine,
  // People
  User, Users, UserPlus, UserCheck, Contact, IdCard, Building2, Briefcase,
  // Commerce
  ShoppingCart, ShoppingBag, CreditCard, Receipt, Wallet, DollarSign,
  Tag, Tags, Truck, Store,
  // Communication
  Mail, MessageSquare, MessagesSquare, Bell, Phone, Send, Megaphone,
  // Time / planning
  Calendar, CalendarDays, CalendarClock, Clock, Timer, History, AlarmClock,
  // Analytics
  ChartBar, ChartLine, ChartPie, TrendingUp, Activity, Gauge, Target,
  // Status
  CircleCheck, CircleAlert, TriangleAlert, CircleHelp, Info, ShieldCheck,
  Lock, KeyRound, Eye,
  // Tools / system
  Settings, Wrench, Cog, Plug, Workflow, GitBranch, Terminal, Bug,
  Cloud, Server, HardDrive, RefreshCw, Download, Upload, Link2,
  // Places / misc
  MapPin, Map, Globe, Navigation, Car, Plane, Factory, Wrench as Tool,
  Stethoscope, GraduationCap, BookOpen, Library, Camera, Image, Video,
  Music, Palette, Puzzle, Layers, Component,
  type LucideIcon,
} from 'lucide-react'

export interface MenuIconGroup {
  label: string
  icons: { name: string; Icon: LucideIcon }[]
}

/** The catalog, grouped for the picker. Order is the order shown. */
export const MENU_ICON_GROUPS: MenuIconGroup[] = [
  {
    label: 'General',
    icons: [
      { name: 'Home', Icon: Home },
      { name: 'LayoutDashboard', Icon: LayoutDashboard },
      { name: 'LayoutGrid', Icon: LayoutGrid },
      { name: 'LayoutList', Icon: LayoutList },
      { name: 'Menu', Icon: MenuIcon },
      { name: 'Compass', Icon: Compass },
      { name: 'Star', Icon: Star },
      { name: 'Heart', Icon: Heart },
      { name: 'Bookmark', Icon: Bookmark },
      { name: 'Flag', Icon: Flag },
      { name: 'Pin', Icon: Pin },
      { name: 'Sparkles', Icon: Sparkles },
      { name: 'Zap', Icon: Zap },
      { name: 'Rocket', Icon: Rocket },
    ],
  },
  {
    label: 'Data',
    icons: [
      { name: 'Database', Icon: Database },
      { name: 'Table2', Icon: Table2 },
      { name: 'List', Icon: List },
      { name: 'ListChecks', Icon: ListChecks },
      { name: 'ListOrdered', Icon: ListOrdered },
      { name: 'Rows3', Icon: Rows3 },
      { name: 'Columns3', Icon: Columns3 },
      { name: 'FileText', Icon: FileText },
      { name: 'Files', Icon: Files },
      { name: 'Folder', Icon: Folder },
      { name: 'FolderOpen', Icon: FolderOpen },
      { name: 'Archive', Icon: Archive },
      { name: 'Inbox', Icon: Inbox },
      { name: 'Package', Icon: Package },
      { name: 'Boxes', Icon: Boxes },
    ],
  },
  {
    label: 'Search',
    icons: [
      { name: 'Search', Icon: Search },
      { name: 'Filter', Icon: Filter },
      { name: 'SlidersHorizontal', Icon: SlidersHorizontal },
      { name: 'ScanLine', Icon: ScanLine },
    ],
  },
  {
    label: 'People',
    icons: [
      { name: 'User', Icon: User },
      { name: 'Users', Icon: Users },
      { name: 'UserPlus', Icon: UserPlus },
      { name: 'UserCheck', Icon: UserCheck },
      { name: 'Contact', Icon: Contact },
      { name: 'IdCard', Icon: IdCard },
      { name: 'Building2', Icon: Building2 },
      { name: 'Briefcase', Icon: Briefcase },
    ],
  },
  {
    label: 'Commerce',
    icons: [
      { name: 'ShoppingCart', Icon: ShoppingCart },
      { name: 'ShoppingBag', Icon: ShoppingBag },
      { name: 'CreditCard', Icon: CreditCard },
      { name: 'Receipt', Icon: Receipt },
      { name: 'Wallet', Icon: Wallet },
      { name: 'DollarSign', Icon: DollarSign },
      { name: 'Tag', Icon: Tag },
      { name: 'Tags', Icon: Tags },
      { name: 'Truck', Icon: Truck },
      { name: 'Store', Icon: Store },
    ],
  },
  {
    label: 'Communication',
    icons: [
      { name: 'Mail', Icon: Mail },
      { name: 'MessageSquare', Icon: MessageSquare },
      { name: 'MessagesSquare', Icon: MessagesSquare },
      { name: 'Bell', Icon: Bell },
      { name: 'Phone', Icon: Phone },
      { name: 'Send', Icon: Send },
      { name: 'Megaphone', Icon: Megaphone },
    ],
  },
  {
    label: 'Time',
    icons: [
      { name: 'Calendar', Icon: Calendar },
      { name: 'CalendarDays', Icon: CalendarDays },
      { name: 'CalendarClock', Icon: CalendarClock },
      { name: 'Clock', Icon: Clock },
      { name: 'Timer', Icon: Timer },
      { name: 'AlarmClock', Icon: AlarmClock },
      { name: 'History', Icon: History },
    ],
  },
  {
    label: 'Analytics',
    icons: [
      { name: 'ChartBar', Icon: ChartBar },
      { name: 'ChartLine', Icon: ChartLine },
      { name: 'ChartPie', Icon: ChartPie },
      { name: 'TrendingUp', Icon: TrendingUp },
      { name: 'Activity', Icon: Activity },
      { name: 'Gauge', Icon: Gauge },
      { name: 'Target', Icon: Target },
    ],
  },
  {
    label: 'Status',
    icons: [
      { name: 'CircleCheck', Icon: CircleCheck },
      { name: 'CircleAlert', Icon: CircleAlert },
      { name: 'TriangleAlert', Icon: TriangleAlert },
      { name: 'CircleHelp', Icon: CircleHelp },
      { name: 'Info', Icon: Info },
      { name: 'ShieldCheck', Icon: ShieldCheck },
      { name: 'Lock', Icon: Lock },
      { name: 'KeyRound', Icon: KeyRound },
      { name: 'Eye', Icon: Eye },
    ],
  },
  {
    label: 'System',
    icons: [
      { name: 'Settings', Icon: Settings },
      { name: 'Wrench', Icon: Wrench },
      { name: 'Cog', Icon: Cog },
      { name: 'Plug', Icon: Plug },
      { name: 'Workflow', Icon: Workflow },
      { name: 'GitBranch', Icon: GitBranch },
      { name: 'Terminal', Icon: Terminal },
      { name: 'Bug', Icon: Bug },
      { name: 'Cloud', Icon: Cloud },
      { name: 'Server', Icon: Server },
      { name: 'HardDrive', Icon: HardDrive },
      { name: 'RefreshCw', Icon: RefreshCw },
      { name: 'Download', Icon: Download },
      { name: 'Upload', Icon: Upload },
      { name: 'Link2', Icon: Link2 },
    ],
  },
  {
    label: 'Places & media',
    icons: [
      { name: 'MapPin', Icon: MapPin },
      { name: 'Map', Icon: Map },
      { name: 'Globe', Icon: Globe },
      { name: 'Navigation', Icon: Navigation },
      { name: 'Car', Icon: Car },
      { name: 'Plane', Icon: Plane },
      { name: 'Factory', Icon: Factory },
      { name: 'Tool', Icon: Tool },
      { name: 'Stethoscope', Icon: Stethoscope },
      { name: 'GraduationCap', Icon: GraduationCap },
      { name: 'BookOpen', Icon: BookOpen },
      { name: 'Library', Icon: Library },
      { name: 'Camera', Icon: Camera },
      { name: 'Image', Icon: Image },
      { name: 'Video', Icon: Video },
      { name: 'Music', Icon: Music },
      { name: 'Palette', Icon: Palette },
      { name: 'Puzzle', Icon: Puzzle },
      { name: 'Layers', Icon: Layers },
      { name: 'Component', Icon: Component },
    ],
  },
]

/** Canonicalizes a stored icon value to lucide's own kebab-case spelling —
 *  "IdCard" (a catalog name, lucide's PascalCase component identifier) and
 *  "id-card" (lucide's real icon name, and everything the app-builder API
 *  writes directly) must resolve to the same icon. Idempotent on an
 *  already-kebab name: with no lowercase→uppercase/digit boundary to split,
 *  the replace is a no-op and `.toLowerCase()` leaves it unchanged. Same
 *  boundary regex as iconSearchText below, just hyphen- rather than
 *  space-joined — including "Table2" → "table-2", lucide's own name for it. */
export function toKebabIconName(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()
}

/** True for any name lucide-react can load dynamically — the ~2,000-icon
 *  superset of the curated catalog below (see the module doc comment and
 *  MenuIcon.tsx's use of this as the gate before rendering a DynamicIcon). */
export function isKnownIconName(name: string): name is IconName {
  return name in dynamicIconImports
}

const BY_NAME: Record<string, LucideIcon> = Object.fromEntries(
  MENU_ICON_GROUPS.flatMap((g) => g.icons.map((i) => [toKebabIconName(i.name), i.Icon] as const)),
)

// ---------------------------------------------------------------------------
// Custom uploaded icons
// ---------------------------------------------------------------------------
//
// `Menu.icon` is one TEXT column carrying two kinds of value:
//
//   "Users"            → a name from the catalog above
//   "content:<uuid>"   → an image uploaded to the content store
//
// A prefix rather than a second column because `icon` already round-trips
// through the API, the published snapshot and every client (the KMP runtime
// included) as an opaque string — a new column would mean touching all of
// that for what is still just "which icon". Lucide's own names are
// PascalCase identifiers and can never contain a colon, so the two spaces
// can't collide.
//
// The image lives under owner kind `app_asset` with no resource id, which
// makes it app-scoped rather than menu-scoped: uploading once puts the icon
// in a small per-app library that any menu can reuse, and deleting a menu
// doesn't take its icon away from the others still using it.
const CUSTOM_ICON_PREFIX = 'content:'

/** True when `icon` names an uploaded image rather than a catalog entry. */
export function isCustomIcon(icon: string | undefined | null): boolean {
  return !!icon && icon.startsWith(CUSTOM_ICON_PREFIX)
}

/** The content-store object id inside a custom icon value, or null. */
export function customIconContentId(icon: string | undefined | null): string | null {
  if (!isCustomIcon(icon)) return null
  const id = icon!.slice(CUSTOM_ICON_PREFIX.length)
  return id || null
}

/** Builds the `Menu.icon` value for an uploaded content object. */
export function customIconValue(contentId: string): string {
  return `${CUSTOM_ICON_PREFIX}${contentId}`
}

/** Resolves a stored `Menu.icon` to its component, or null.
 *
 *  Returns null for an unset icon AND for a name this build doesn't carry —
 *  a menu authored against a longer catalog, or one whose icon was removed
 *  from the list above. Callers fall back to the menu TYPE's icon, so an
 *  unknown name degrades to exactly the pre-icon behavior rather than
 *  rendering a hole. */
export function resolveMenuIcon(name: string | undefined | null): LucideIcon | null {
  if (!name || isCustomIcon(name)) return null
  return BY_NAME[toKebabIconName(name)] ?? null
}

/** Accepted upload types for a custom icon. SVG is included and rendered
 *  only ever through `<img src>`, which does not execute script — never
 *  inlined into the DOM, where an uploaded SVG would be an XSS vector. */
export const CUSTOM_ICON_MIME_TYPES = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg']

/** Icons are UI chrome rendered at 14-16px; anything approaching a megabyte
 *  is a mistake worth catching at the file picker rather than after a round
 *  trip. The server's own maxUploadBytes remains the real ceiling. */
export const CUSTOM_ICON_MAX_BYTES = 512 * 1024

/** Validates a chosen file, returning an error message or null. */
export function validateCustomIconFile(file: File): string | null {
  if (!CUSTOM_ICON_MIME_TYPES.includes(file.type)) {
    return `${file.name} is a ${file.type || 'unknown'} file — use a PNG, SVG, WebP or JPEG.`
  }
  if (file.size > CUSTOM_ICON_MAX_BYTES) {
    return `${file.name} is ${(file.size / 1024).toFixed(0)} KB — icons must be under ${CUSTOM_ICON_MAX_BYTES / 1024} KB.`
  }
  return null
}

/** Every catalog name, for search and for tests. */
export function menuIconNames(): string[] {
  return Object.keys(BY_NAME)
}

/** Splits a PascalCase icon name into searchable words ("ShoppingCart" →
 *  "shopping cart") so the picker's search matches how people type. */
export function iconSearchText(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase()
}
