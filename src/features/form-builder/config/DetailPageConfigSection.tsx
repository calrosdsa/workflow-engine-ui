// "Detail Page" section of the Form Builder's Form Settings panel
// (FR-D2-015) — reorder/hide/add/configure the tabs RecordDetailPanel
// renders for this form. Structurally the "pick a type from a registry,
// then configure it" flow the Dashboard's own Toolbox + widget ConfigPanel
// already establishes, mounted here instead since a form has no equivalent
// full-screen builder of its own.
import { useState } from 'react'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, Trash2, Plus, Lock, Users2, GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { allDetailTabs, getDetailTab, resolveDetailTabs } from '@/features/forms/runtime/detail-tabs/registry'
import { DetailTabConfigForm } from '@/features/forms/runtime/detail-tabs/DetailTabConfigForm'
import '@/features/forms/runtime/detail-tabs'
import { cn } from '@/lib/utils'
import type { DetailTabConfig } from '../schema'

interface DetailPageConfigSectionProps {
  formId: string
  detailTabs: DetailTabConfig[] | undefined
  onChange: (next: DetailTabConfig[]) => void
  /** false for the group tab type's own ConfigPanel (nested use) — an empty
   *  group's config.tabs is genuinely empty, not "fall back to the fixed
   *  Details/Audit Log/Linked Records default," which only makes sense for
   *  a FORM's top-level detailTabs (resolveDetailTabs' own doc comment).
   *  Also disables the "at least one tab must stay visible" exclusivity
   *  guard, which is a real constraint on a form's detail page but not on a
   *  group — an empty or fully-hidden group is a valid, if unhelpful, state. */
  applyDefault?: boolean
}

export function DetailPageConfigSection({ formId, detailTabs, onChange, applyDefault = true }: DetailPageConfigSectionProps) {
  const tabs = applyDefault ? resolveDetailTabs(detailTabs) : (detailTabs ?? [])
  const visibleCount = applyDefault ? tabs.filter((t) => !t.hidden).length : Infinity
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = tabs.findIndex((t) => t.id === active.id)
    const newIndex = tabs.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(tabs, oldIndex, newIndex))
  }

  const patchTab = (id: string, patch: Partial<DetailTabConfig>) =>
    onChange(tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const toggleHidden = (id: string) => {
    const t = tabs.find((x) => x.id === id)
    if (!t) return
    // Guard: at least one tab must stay visible (FR-D2-015 §5's exclusivity
    // rule) — refuse to hide the last visible one rather than silently
    // producing an unviewable detail page.
    if (!t.hidden && visibleCount <= 1) return
    patchTab(id, { hidden: !t.hidden })
  }

  const removeTab = (id: string) => {
    const t = tabs.find((x) => x.id === id)
    if (!t) return
    if (!t.hidden && visibleCount <= 1) return
    onChange(tabs.filter((x) => x.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const addTab = (type: string) => {
    const def = getDetailTab(type)
    if (!def) return
    const newTab: DetailTabConfig = { id: nanoid(), type, config: def.createDefaultConfig() }
    onChange([...tabs, newTab])
    setExpandedId(newTab.id)
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <Accordion
            type="single"
            collapsible
            value={expandedId ?? ''}
            onValueChange={(v) => setExpandedId(v || null)}
            className="flex flex-col gap-2"
          >
            {tabs.map((t) => (
              <DetailTabRow
                key={t.id}
                formId={formId}
                tab={t}
                onToggleHidden={() => toggleHidden(t.id)}
                onRemove={() => removeTab(t.id)}
                onPatch={(patch) => patchTab(t.id, patch)}
                canHide={t.hidden || visibleCount > 1}
              />
            ))}
          </Accordion>
        </SortableContext>
      </DndContext>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[hsl(var(--border))] py-2 text-[12px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus size={13} /> Add Tab
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-72">
          {/* field_ref is picked via a dedicated "Add Field" flow on the
             Detail Page Builder canvas (a field picker, not a generic tab
             type), not this generic type picker — an existing field_ref
             entry still renders/configures fine here if one was added
             there, this just keeps it out of the "add new" list. */}
          {allDetailTabs().filter((def) => def.type !== 'field_ref').map((def) => (
            <DropdownMenuItem key={def.type} onClick={() => addTab(def.type)} className="items-start gap-2.5 py-2">
              <def.icon size={15} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-[hsl(var(--foreground))]">{def.label}</span>
                <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{def.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function DetailTabRow({ formId, tab, onToggleHidden, onRemove, onPatch, canHide }: {
  formId: string
  tab: DetailTabConfig
  onToggleHidden: () => void
  onRemove: () => void
  onPatch: (patch: Partial<DetailTabConfig>) => void
  canHide: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })
  const def = getDetailTab(tab.type)
  const style = { transform: CSS.Transform.toString(transform), transition }
  const isConditional = tab.renderIf?.mode === 'expression'
  const hasCustomVisibility = (tab.visibility?.mode ?? 'everyone') !== 'everyone'

  return (
    <AccordionItem
      ref={setNodeRef}
      style={style}
      value={tab.id}
      className={cn(
        'overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
        isDragging && 'z-10 opacity-70 shadow-md',
        tab.hidden && 'bg-[hsl(var(--muted))]/40',
      )}
    >
      <div className="flex items-center gap-1.5 pl-1 pr-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1.5 text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--muted-foreground))] active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        <AccordionTrigger className="min-w-0 flex-1 gap-2 py-2.5 text-left normal-case tracking-normal text-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {def && <def.icon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}
            <span className={cn('truncate text-[13px] font-medium', tab.hidden && 'text-[hsl(var(--muted-foreground))]')}>
              {tab.label || def?.label || tab.type}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {def?.builtin && (
                <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium normal-case tracking-normal text-[hsl(var(--muted-foreground))]">
                  <Lock size={9} /> Built-in
                </Badge>
              )}
              {tab.hidden && (
                <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[9.5px] font-medium normal-case tracking-normal">Hidden</Badge>
              )}
              {hasCustomVisibility && (
                <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium normal-case tracking-normal text-[hsl(var(--muted-foreground))]">
                  <Users2 size={9} /> Restricted
                </Badge>
              )}
              {isConditional && (
                <Badge variant="outline" className="h-5 gap-0.5 px-1.5 py-0 text-[9.5px] font-medium normal-case tracking-normal text-[hsl(var(--muted-foreground))]">
                  <GitBranch size={9} /> Conditional
                </Badge>
              )}
            </span>
          </span>
        </AccordionTrigger>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleHidden}
            disabled={!canHide}
            title={tab.hidden ? 'Show tab' : canHide ? 'Hide tab' : 'At least one tab must stay visible'}
            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {tab.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canHide}
            title={canHide ? 'Remove tab' : 'At least one tab must stay visible'}
            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <AccordionContent className="border-t border-[hsl(var(--border))] px-3 pb-0 pt-3.5">
        {def && <DetailTabConfigForm formId={formId} tab={tab} onPatch={onPatch} />}
      </AccordionContent>
    </AccordionItem>
  )
}
