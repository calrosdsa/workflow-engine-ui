import type { LucideIcon } from 'lucide-react'
import { MenuIcon } from './MenuIcon'
import { cn } from '@/lib/utils'

const SIZES = {
  lg: { box: 'h-16 w-16 rounded-2xl', icon: 28 },
  md: { box: 'h-11 w-11 rounded-xl', icon: 20 },
} as const

interface MenuIconTileProps {
  icon: string | undefined | null
  fallback: LucideIcon
  size?: keyof typeof SIZES
  className?: string
}

/** A menu icon inside a colored rounded-square box, sized for a launcher
 *  tile (RuntimeHomePage, ModuleDrilldownDialog) rather than a nav row.
 *  Composes MenuIcon as-is (catalog glyph, uploaded image, graceful
 *  fallback — all reused verbatim); this component only supplies the box.
 *  Same `hsl(var(--primary) / 0.1)` background / `hsl(var(--primary))` icon
 *  color already used for this exact box shape in ParentMenuRuntime.tsx and
 *  the builder's MenuTypePickerDialog — just bigger, and with no new
 *  per-module color configuration. */
export function MenuIconTile({ icon, fallback, size = 'lg', className }: MenuIconTileProps) {
  const { box, icon: iconSize } = SIZES[size]
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center', box, className)}
      style={{ backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
    >
      <MenuIcon icon={icon} fallback={fallback} size={iconSize} />
    </div>
  )
}
