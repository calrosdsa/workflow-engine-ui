import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useFormBuilderStore } from '../store'
import { SectionCard } from './SectionCard'

/**
 * The droppable canvas. Must be rendered inside <FormBuilderDnd> so its columns
 * and sortable sections share the single builder DndContext.
 */
export function FormCanvas() {
  const t = useTranslation()
  const schema = useFormBuilderStore((s) => s.schema)
  const addSection = useFormBuilderStore((s) => s.addSection)
  const selectElement = useFormBuilderStore((s) => s.selectItem)

  const hasSections = schema.sections.length > 0

  return (
    // Click empty canvas to deselect — a supplementary pointer gesture
    // (SectionCard's own onClick stops propagation, so this only fires on
    // the background itself). No keyboard equivalent exists yet for
    // deselecting; a keyboard user reaches the same end by selecting a
    // different section. A fake button/tabIndex on this whole canvas would
    // be a worse regression than the gap it "fixes".
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div className="flex h-full flex-1 flex-col bg-[hsl(var(--muted))]" onClick={() => selectElement(null)}>
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          {!hasSections && <EmptyCanvas onAddSection={addSection} />}

          <SortableContext items={schema.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {schema.sections.map((section) => (
                <SectionCard key={section.id} section={section} />
              ))}
            </div>
          </SortableContext>

          {hasSections && (
            <Button
              variant="outline"
              onClick={(e) => { e.stopPropagation(); addSection() }}
              className="w-full gap-2 border-dashed border-[hsl(var(--border))] py-6 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 hover:text-[hsl(var(--primary))]"
            >
              <Plus size={16} /> {t('builder.canvas.add_section')}
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------

function EmptyCanvas({ onAddSection }: { onAddSection: () => void }) {
  const t = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))]/60 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--muted))]">
        <LayoutGrid size={26} className="text-[hsl(var(--muted-foreground))]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{t('builder.canvas.empty_title')}</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('builder.canvas.empty_hint')}</p>
      </div>
      <Button onClick={(e) => { e.stopPropagation(); onAddSection() }} className="mt-1 gap-2">
        <Plus size={15} /> {t('builder.canvas.add_section')}
      </Button>
    </div>
  )
}
