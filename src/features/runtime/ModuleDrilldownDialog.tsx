import { useState } from 'react'
import { ArrowLeft, HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getMenuType } from '@/features/menus/menu-registry'
import { MenuIconTile } from '@/features/menus/MenuIconTile'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { MenuTreeNode } from '@/features/menus/types'

interface ModuleDrilldownDialogProps {
  open: boolean
  root: MenuTreeNode
  onClose: () => void
  onNavigate: (slug: string) => void
}

// Home page popup for a module that groups other modules (screenshot 2's
// "Accounting" grid): shows the current level's module-type children as a
// grid of tiles. Clicking one that itself has module children drills one
// level deeper, replacing the dialog's content in place; clicking a leaf
// child closes the dialog and navigates. RuntimeHomePage only opens this for
// a tile that already has >=1 module-type child, so the initial level is
// never empty.
export function ModuleDrilldownDialog({ open, root, onClose, onNavigate }: ModuleDrilldownDialogProps) {
  const [stack, setStack] = useState<MenuTreeNode[]>([root])
  const t = useTranslation()
  const current = stack[stack.length - 1]
  const children = current.children.filter((c) => c.menu_type === 'module')

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
      // Reset for next time this dialog is mounted fresh with a new root —
      // RuntimeHomePage unmounts it entirely on close (drilldownRoot becomes
      // null), so this is defensive rather than load-bearing.
      setStack([root])
    }
  }

  const pick = (child: MenuTreeNode) => {
    const grandchildren = child.children.filter((c) => c.menu_type === 'module')
    if (grandchildren.length > 0) {
      setStack((s) => [...s, child])
      return
    }
    onNavigate(child.slug)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {stack.length > 1 && (
              <button
                onClick={() => setStack((s) => s.slice(0, -1))}
                aria-label={t('runtime.home.drilldown_back')}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <DialogTitle>{current.name}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4 p-2 sm:grid-cols-4">
          {children.map((child) => {
            const fallbackIcon = getMenuType(child.menu_type)?.icon
            return (
              <button
                key={child.id}
                onClick={() => pick(child)}
                className="flex flex-col items-center gap-2 rounded-lg p-2 text-center transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                <MenuIconTile icon={child.icon} fallback={fallbackIcon ?? HelpCircle} size="md" />
                <span className="line-clamp-2 text-xs font-medium">{child.name}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
