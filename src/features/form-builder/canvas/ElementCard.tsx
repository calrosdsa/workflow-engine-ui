import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Trash2, Asterisk, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useFormBuilderStore, useFormMetaStore } from '../store'
import { COMPONENT_REGISTRY } from '../component-registry'
import { ElementPreview } from '../ElementPreview'
import { isParentLinkElement } from '../factory'
import type { FormElement } from '../schema'

interface ElementCardProps {
  element: FormElement
  sectionId: string
  columnId: string
}

// Memoized on default shallow prop comparison — `element` now keeps a
// stable reference across store mutations that don't touch it (see
// builder-kit/tree-store.ts's produce(), now real Immer instead of a
// structuredClone-the-whole-tree stand-in that gave every element a fresh
// identity on every mutation, anywhere in the schema). Without that fix
// this memo would silently never skip a render — worth knowing before
// "helpfully" reverting it. Still re-renders on its own selectedId store
// subscription regardless of props, which is correct: it needs to know if
// IT is the selected card.
export const ElementCard = memo(function ElementCard({ element, sectionId, columnId }: ElementCardProps) {
  const selectedId = useFormBuilderStore((s) => s.selectedItemId)
  const selectElement = useFormBuilderStore((s) => s.selectItem)
  const duplicate = useFormBuilderStore((s) => s.duplicateItemById)
  const remove = useFormBuilderStore((s) => s.deleteItem)
  const parentFormId = useFormMetaStore((s) => s.parentFormId)

  const selected = selectedId === element.id
  const reg = COMPONENT_REGISTRY[element.component]
  const Icon = reg.icon
  // The auto-injected "link back to parent" field (see isParentLinkElement's
  // doc comment) — deletable via this card's own trash icon like any other
  // element, but doing so used to silently strip the reference value from
  // every existing record while leaving the form's parent_form_id dangling.
  // Locked here instead of just warning, since there's no legitimate reason
  // to delete this specific field short of unlinking the dependent-form
  // relationship entirely, which has its own dedicated action.
  const isParentLink = isParentLinkElement(element, parentFormId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
    data: { kind: 'element', elementId: element.id, sectionId, columnId },
  })
  const reducedMotion = usePrefersReducedMotion()

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: reducedMotion ? undefined : transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectElement(element.id) }}
      className={cn(
        'group relative rounded-lg border bg-[hsl(var(--card))] transition-shadow motion-reduce:transition-none',
        selected ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25 shadow-sm' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border))] hover:shadow-sm',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      {/* Hover/selected toolbar — group-focus-within (not just group-hover)
          so a sighted keyboard user tabbing onto Drag/Duplicate/Delete
          actually sees the row they just focused, matching the same fix
          already applied to detail-page-builder/canvas/TabCard.tsx. */}
      <div className={cn(
        'absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-0.5 py-0.5 shadow-sm transition-opacity motion-reduce:transition-none',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}>
        <div className="relative">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to move"
            className="peer flex h-6 w-6 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 active:cursor-grabbing"
            title="Drag to move"
          >
            <GripVertical size={13} />
          </button>
          {/* Visible-on-keyboard-focus hint — the button's own aria-label and
              dnd-kit's built-in sr-only instructions already cover screen
              readers; this covers the sighted keyboard-only user who can't
              rely on either. Hidden by default, shown only via :focus-visible
              on the sibling button (peer), never on hover — the title
              attribute already handles the mouse case. */}
          <span
            role="presentation"
            className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--popover-foreground))] shadow-sm peer-focus-visible:block"
          >
            Space to drag, arrows to move
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); duplicate(element.id) }}
          aria-label="Duplicate"
          className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
        {!isParentLink && (
          <button
            onClick={(e) => { e.stopPropagation(); remove(element.id) }}
            aria-label="Delete"
            className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Type tag */}
      <div className="flex items-center gap-1.5 border-b border-[hsl(var(--border))] px-2.5 py-1">
        <Icon size={11} className="text-[hsl(var(--muted-foreground))]" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{reg.label}</span>
        {element.behavior.required === 'always' && <Asterisk size={8} className="text-[hsl(var(--destructive))]" />}
        {isParentLink && (
          <span
            className="flex items-center gap-1 rounded bg-[hsl(var(--primary))]/15 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--primary))]"
            title="Links this form to its parent — use “Unlink Dependent Form” from the form list to remove the relationship instead"
          >
            <Link2 size={9} />parent link
          </span>
        )}
        {element.behavior.visibility !== 'always' && (
          <span className="ml-auto rounded bg-[hsl(var(--warning))]/15 px-1.5 py-0.5 text-[9px] font-medium text-[hsl(var(--warning))]">conditional</span>
        )}
      </div>

      {/* Preview */}
      <div className="p-2.5">
        <ElementPreview element={element} />
      </div>
    </div>
  )
})
