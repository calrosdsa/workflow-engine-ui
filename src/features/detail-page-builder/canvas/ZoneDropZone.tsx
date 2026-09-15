// One droppable zone (main/sidebar/etc, per the form's active
// DetailPageLayoutId) on the Detail Page Builder canvas — mirrors
// form-builder/canvas/ColumnDropZone.tsx's useDroppable + nested
// SortableContext pattern, applied to a fixed set of named zones instead of
// N dynamic columns.
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { TabCard } from './TabCard'
import { isAlwaysPresentDetailTab } from '@/features/forms/runtime/detail-tabs/registry'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfig, DetailPageZoneDef } from '@/features/form-builder/schema'

interface ZoneDropZoneProps {
  zone: DetailPageZoneDef
  tabs: DetailTabConfig[]
  selectedTabId: string | null
  visibleCount: number
  onSelect: (id: string) => void
  onToggleHidden: (id: string) => void
  onRemove: (id: string) => void
}

export function ZoneDropZone({ zone, tabs, selectedTabId, visibleCount, onSelect, onToggleHidden, onRemove }: ZoneDropZoneProps) {
  const t = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${zone.id}`,
    data: { kind: 'zone', zoneId: zone.id },
  })

  const isEmpty = tabs.length === 0

  return (
    <div className={cn('flex min-h-0 flex-col', zone.width === 'flex' ? 'flex-1 min-w-0' : 'w-72 shrink-0')}>
      {/* zone.label stays a literal in schema.ts's MAIN_ZONE/SIDEBAR_ZONE/
          ACTIVITY_ZONE consts (same registry-seed pattern as every other
          registry this effort has touched) — reconstructed here via the
          zone's own stable `id`, not read raw, since this is the zone
          set's only real consumer (ZonedDetailTabList.tsx/store.ts only
          ever touch `.zones` structurally, never `.label`). */}
      <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t(`detail_tab.canvas.zone.${zone.id}.label`)}</p>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg border-2 border-dashed p-2 transition-colors',
          isOver ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--accent))]' : isEmpty ? 'border-[hsl(var(--border))]' : 'border-transparent',
        )}
      >
        <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {tabs.map((t) => (
              <TabCard
                key={t.id}
                tab={t}
                zoneId={zone.id}
                selected={selectedTabId === t.id}
                canHide={t.hidden || visibleCount > 1}
                canRemove={(t.hidden || visibleCount > 1) && !isAlwaysPresentDetailTab(t.type)}
                onSelect={() => onSelect(t.id)}
                onToggleHidden={() => onToggleHidden(t.id)}
                onRemove={() => onRemove(t.id)}
              />
            ))}
          </div>
        </SortableContext>

        {isEmpty && (
          <div className={cn(
            'flex min-h-[72px] items-center justify-center text-center text-[11px] transition-colors',
            isOver ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]/60',
          )}>
            {isOver ? t('detail_tab.canvas.drop_here') : t('detail_tab.canvas.empty_zone')}
          </div>
        )}
      </div>
    </div>
  )
}
