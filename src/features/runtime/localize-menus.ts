import type { MenuSnapshotItem } from './types'

// Menu names are the one piece of translatable content that lives OUTSIDE a
// form's own layout (see features/form-builder/localize-schema.ts's own doc
// comment for that seam) — they're a flat, top-level array on the app
// snapshot, not nested inside any one form's schema, so they get their own
// tiny key scheme (`menu.<menuId>.name`) and their own resolver here rather
// than folding into localize-schema.ts.
//
// Applied ONCE, in runtime-router.tsx, to the snapshot placed into
// RuntimeSnapshotContext — every downstream consumer of
// useRuntimeSnapshotContext() (RuntimeSidebar, RuntimeBreadcrumbs, the nav
// tree builder, every menu-type runtimeRenderer that reads menu.name) then
// sees already-localized names with no changes of its own, same "one seam"
// reasoning localizeFormSchema uses for form content.
export function localizeMenus(
  menus: MenuSnapshotItem[],
  tc: (key: string, fallback: string) => string,
): MenuSnapshotItem[] {
  return menus.map((m) => ({ ...m, name: tc(`menu.${m.id}.name`, m.name) }))
}
