import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Trash2, Asterisk, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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

export function ElementCard({ element, sectionId, columnId }: ElementCardProps) {
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

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectElement(element.id) }}
      className={cn(
        'group relative rounded-lg border bg-[hsl(var(--card))] transition-shadow',
        selected ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/25 shadow-sm' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border))] hover:shadow-sm',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      {/* Hover/selected toolbar */}
      <div className={cn(
        'absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-0.5 py-0.5 shadow-sm transition-opacity',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to move"
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 active:cursor-grabbing"
          title="Drag to move"
        >
          <GripVertical size={13} />
        </button>
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
}
