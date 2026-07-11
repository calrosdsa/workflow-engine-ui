import { AlertTriangle } from 'lucide-react'
import { useMenus } from '@/features/menus/hooks'

interface MenuSlugSelectProps {
  value: string
  onChange: (slug: string) => void
  /** Exclude this menu id from the list — used when the picker is being
   *  rendered inside the menu it belongs to, so a button can't target its own
   *  page. */
  excludeMenuId?: string
}

// Near-copy of AddMenuConfigPanel.tsx's existing inline redirect_menu_slug
// <select> (same useMenus() source, same {name}/{slug} option shape),
// factored into its own small component since the page-builder's button
// component needs the identical picker.
export function MenuSlugSelect({ value, onChange, excludeMenuId }: MenuSlugSelectProps) {
  const { data: allMenus, isLoading } = useMenus()
  const otherMenus = (allMenus ?? []).filter((m) => m.id !== excludeMenuId)
  // A <select> with a value that doesn't match any <option> just silently
  // shows nothing selected — no clear signal that the reference is broken
  // (e.g. the target menu was since deleted). Same broken-reference warning
  // ElementPreview.tsx's FormRefControl already shows for a dangling form
  // reference, applied here for a dangling menu-slug reference.
  const isBroken = !!value && !isLoading && !otherMenus.some((m) => m.slug === value)

  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
      >
        <option value="">Select a menu…</option>
        {otherMenus.map((m) => (
          <option key={m.id} value={m.slug}>{m.name}</option>
        ))}
        {isBroken && <option value={value}>{value} (missing)</option>}
      </select>
      {isBroken && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          <AlertTriangle size={12} className="shrink-0" />
          <span>This menu no longer exists — pick a new target.</span>
        </div>
      )}
    </div>
  )
}
