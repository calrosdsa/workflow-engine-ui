// The icon vocabulary a menu may choose from.
//
// `Menu.icon` has always existed on the type, on the API (api/menus's
// `Icon *string`) and in the database — it was simply never settable, and
// both the builder tree and the runtime sidebar rendered
// MENU_TYPE_REGISTRY[menu_type].icon instead. This module supplies the
// missing half: a name→component resolver plus the catalog the picker
// renders.
//
// WHY A CURATED LIST RATHER THAN ALL OF LUCIDE
// -------------------------------------------
// lucide-react ships ~1,500 icons and tree-shakes on named imports. A
// `import * as icons` resolver would defeat that and pull every one of them
// into the bundle — including the RUNTIME bundle, which renders these in its
// sidebar and which this codebase deliberately keeps separate from the
// builder's (see workflow-engine-ui's two-bundle split). The ~90 icons below
// are the ones that actually read as navigation at 14px, grouped the way
// someone naming a menu would look for them.
//
// Adding one is a two-line change: import it, and add it to a group's
// `icons` array. Names are lucide's own PascalCase component names, stored
// verbatim as the `icon` string, so a name is portable to any other client
// rendering the same menu (the KMP mobile runtime included).

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

const BY_NAME: Record<string, LucideIcon> = Object.fromEntries(
  MENU_ICON_GROUPS.flatMap((g) => g.icons.map((i) => [i.name, i.Icon] as const)),
)

/** Resolves a stored `Menu.icon` to its component, or null.
 *
 *  Returns null for an unset icon AND for a name this build doesn't carry —
 *  a menu authored against a longer catalog, or one whose icon was removed
 *  from the list above. Callers fall back to the menu TYPE's icon, so an
 *  unknown name degrades to exactly the pre-icon behavior rather than
 *  rendering a hole. */
export function resolveMenuIcon(name: string | undefined | null): LucideIcon | null {
  if (!name) return null
  return BY_NAME[name] ?? null
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
