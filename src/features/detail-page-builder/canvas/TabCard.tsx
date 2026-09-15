// One draggable card on the Detail Page Builder canvas, representing one
// DetailTabConfig entry — follows the same drag-handle/select/delete chrome
// shape as form-builder/canvas/ElementCard.tsx, applied to a tab instead of
// a field.
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, Trash2, Lock, Users2, GitBranch } from 'lucide-react'
import { cn, onKeyboardActivate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getDetailTab } from '@/features/forms/runtime/detail-tabs/registry'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfig } from '@/features/form-builder/schema'

interface TabCardProps {
  tab: DetailTabConfig
  zoneId: string
  selected: boolean
  canHide: boolean
  /** Gates ONLY the Remove button — pass false for a type resolveDetailTabs
   *  backfills onto every form (see isAlwaysPresentDetailTab's own doc
   *  comment), even when canHide is true. Hide/Show stays fully available
   *  regardless — this only closes the "Remove looks like it worked, then
   *  silently reverts" gap for those specific types. Defaults to true (same
   *  as an ordinary removable tab) so existing callers/tests that don't
   *  care about this distinction need no change. */
  canRemove?: boolean
  onSelect: () => void
  onToggleHidden: () => void
  onRemove: () => void
}

export function TabCard({ tab, zoneId, selected, canHide, canRemove = true, onSelect, onToggleHidden, onRemove }: TabCardProps) {
  const t = useTranslation()
  const def = getDetailTab(tab.type)
  const isConditional = tab.renderIf?.mode === 'expression'
  const hasCustomVisibility = (tab.visibility?.mode ?? 'everyone') !== 'everyone'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    data: { kind: 'tab', tabId: tab.id, zoneId },
  })

  const style = { transform: CSS.Translate.toString(transform), transition }

  const displayLabel = tab.label || def?.label || tab.type

  return (
    <div
      ref={setNodeRef}
      style={style}
      // role="group" (not "button") because the card contains its own real
      // interactive descendants (the drag handle + hide/remove buttons
      // below) — matches the established in-repo convention for this exact
      // shape, dashboard/canvas/WidgetTile.tsx. onKeyboardActivate's own
      // target-check keeps Enter/Space bubbling up from those descendants
      // from ALSO re-triggering onSelect, the same reason onClick below
      // needs e.stopPropagation() on the mouse side.
      role="group"
      aria-label={`${t('detail_tab.canvas.tab_aria_label', { label: displayLabel })}${selected ? t('detail_tab.canvas.selected_suffix') : ''}`}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onKeyDown={onKeyboardActivate(onSelect)}
      className={cn(
        'group relative rounded-lg border bg-[hsl(var(--card))] transition-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
        selected ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25 shadow-sm' : 'border-[hsl(var(--border))] hover:shadow-sm',
        tab.hidden && 'bg-[hsl(var(--muted))]/40',
        isDragging && 'z-10 opacity-60 shadow-lg',
      )}
    >
      {/* Hover/selected toolbar — same floating-pill position and shape as
          form-builder/canvas/ElementCard.tsx's, built on semantic tokens
          instead of raw colors. Pinned fully visible while selected (not
          just on hover), and also on keyboard focus via group-focus-within,
          so the actions stay discoverable without a pointer over the card. */}
      <div className={cn(
        'absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-0.5 py-0.5 shadow-sm transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded text-[hsl(var(--muted-foreground))]/60 hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--card))] active:cursor-grabbing"
          title={t('detail_tab.canvas.drag_to_move')}
        >
          <GripVertical size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleHidden() }}
          disabled={!canHide}
          title={tab.hidden ? t('detail_tab.section.show_tab') : canHide ? t('detail_tab.section.hide_tab') : t('detail_tab.section.must_stay_visible')}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--card))] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tab.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          disabled={!canRemove}
          title={!canHide ? t('detail_tab.section.must_stay_visible') : canRemove ? t('detail_tab.section.remove_tab') : t('detail_tab.section.always_shown_hide_instead')}
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--card))] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-2">
        {def && <def.icon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}

        <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', tab.hidden && 'text-[hsl(var(--muted-foreground))]')}>
          {displayLabel}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {def?.builtin && (
            <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium text-[hsl(var(--muted-foreground))]">
              <Lock size={9} />
            </Badge>
          )}
          {hasCustomVisibility && (
            <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium text-[hsl(var(--muted-foreground))]">
              <Users2 size={9} />
            </Badge>
          )}
          {isConditional && (
            <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium text-[hsl(var(--muted-foreground))]">
              <GitBranch size={9} />
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
