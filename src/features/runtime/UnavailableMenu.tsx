import { AlertTriangle } from 'lucide-react'

/** Rendered in place of a menu's `runtimeRenderer` when its `menu_type` is not
 *  in MENU_TYPE_REGISTRY — the menu-level analog of the dashboard's
 *  UnavailableWidget.
 *
 *  Only reachable when a published snapshot carries a type this build does not
 *  register: a menu type removed or renamed in a later release while old rows
 *  still reference it, or a row written by something other than the builder
 *  (whose creation flow is registry-exhaustive). The snapshot fetch is a
 *  compile-time type assertion with no runtime validation, so nothing upstream
 *  catches it either — this is the last line of defence, and it has to be a
 *  render, not a throw, because there is no error boundary anywhere above it.
 *  See FR-D1-008. */
export function UnavailableMenu({ type }: { type: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <AlertTriangle size={22} className="text-[hsl(var(--muted-foreground))]/60" />
      <p className="text-sm font-medium text-[hsl(var(--foreground))]">Menu unavailable</p>
      <p className="max-w-sm text-xs text-[hsl(var(--muted-foreground))]">
        Type "{type}" is not registered in this version of the app. The rest of your navigation is unaffected.
      </p>
    </div>
  )
}
