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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { RoleMultiSelect } from './RoleMultiSelect'
import { UserMultiSelect } from './UserMultiSelect'
import { ExpressionField } from './ExpressionField'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { allDetailTabs, getDetailTab, resolveDetailTabs } from '@/features/forms/runtime/detail-tabs/registry'
import '@/features/forms/runtime/detail-tabs'
import { cn } from '@/lib/utils'
import type { DetailTabConfig, TabVisibilityConfig } from '../schema'
import type { VariableDecl } from '@/features/workflows/types'

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
          {allDetailTabs().map((def) => (
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
            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <AccordionContent className="border-t border-[hsl(var(--border))] px-3 pb-0 pt-0">
        {def && (
          <div className="flex flex-col gap-4 py-3.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Label</Label>
              <Input
                value={tab.label ?? ''}
                onChange={(e) => onPatch({ label: e.target.value })}
                placeholder={def.label}
                className="h-8 text-sm"
              />
            </div>

            {def.ConfigPanel && (
              <def.ConfigPanel
                config={def.parseConfig(tab.config)}
                onChange={(config) => onPatch({ config })}
                formId={formId}
              />
            )}

            <TabVisibilitySection
              visibility={tab.visibility}
              onChange={(visibility) => onPatch({ visibility })}
            />

            <TabRenderIfSection
              renderIf={tab.renderIf}
              onChange={(renderIf) => onPatch({ renderIf })}
            />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

function TabVisibilitySection({ visibility, onChange }: {
  visibility: TabVisibilityConfig | undefined
  onChange: (v: TabVisibilityConfig) => void
}) {
  const mode = visibility?.mode ?? 'everyone'
  const roleIds = visibility?.roleIds ?? []
  const userIds = visibility?.userIds ?? []

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3">
      <div className="flex items-center gap-1.5">
        <Users2 size={12} className="text-[hsl(var(--muted-foreground))]" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Who can see this tab</p>
      </div>
      <SelectMenu value={mode} onValueChange={(v) => onChange({ mode: v as TabVisibilityConfig['mode'], roleIds, userIds })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="everyone" className="text-xs">Everyone</SelectItem>
          <SelectItem value="roles" className="text-xs">Specific roles</SelectItem>
          <SelectItem value="users" className="text-xs">Specific people</SelectItem>
          <SelectItem value="roles_or_users" className="text-xs">Specific roles or people</SelectItem>
        </SelectContent>
      </SelectMenu>
      {(mode === 'roles' || mode === 'roles_or_users') && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Roles</Label>
          <RoleMultiSelect value={roleIds} onChange={(ids) => onChange({ mode, roleIds: ids, userIds })} />
        </div>
      )}
      {(mode === 'users' || mode === 'roles_or_users') && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">People</Label>
          <UserMultiSelect value={userIds} onChange={(ids) => onChange({ mode, roleIds, userIds: ids })} />
        </div>
      )}
    </div>
  )
}

function TabRenderIfSection({ renderIf, onChange }: {
  renderIf: DetailTabConfig['renderIf']
  onChange: (r: NonNullable<DetailTabConfig['renderIf']>) => void
}) {
  const isConditional = renderIf?.mode === 'expression'
  // Tab-level renderIf reuses the exact Vars["fieldKey"] addressing field-
  // level visibleWhen already uses (expression-context.ts) — no per-form
  // variable declarations are threaded in here since this panel doesn't
  // have this form's own field list in scope the way ElementConfig's
  // RuleGroup does; the field-key hint below documents the same convention
  // without wiring live autocomplete for it.
  const emptyVariables: VariableDecl[] = []

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3">
      <div className="flex items-center gap-1.5">
        <GitBranch size={12} className="text-[hsl(var(--muted-foreground))]" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">When this tab appears</p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Checkbox
          checked={isConditional}
          onCheckedChange={(v) => onChange(v ? { mode: 'expression', expressionWhen: renderIf?.expressionWhen ?? '' } : { mode: 'always' })}
        />
        <Label className="cursor-pointer text-[12px] font-normal text-[hsl(var(--muted-foreground))]">Only show this tab conditionally</Label>
      </label>
      {isConditional && (
        <ExpressionField
          value={renderIf?.expressionWhen ?? ''}
          onChange={(v) => onChange({ mode: 'expression', expressionWhen: v })}
          variables={emptyVariables}
          placeholder='Vars["stage"] == "closed_won"'
          label="visible when"
        />
      )}
    </div>
  )
}
