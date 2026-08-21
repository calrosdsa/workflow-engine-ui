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
import { GripVertical, Eye, EyeOff, Trash2, ChevronDown, Plus } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
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
}

export function DetailPageConfigSection({ formId, detailTabs, onChange }: DetailPageConfigSectionProps) {
  const tabs = resolveDetailTabs(detailTabs)
  const visibleCount = tabs.filter((t) => !t.hidden).length
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

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
    setPickerOpen(false)
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {tabs.map((t) => (
              <DetailTabRow
                key={t.id}
                formId={formId}
                tab={t}
                expanded={expandedId === t.id}
                onToggleExpand={() => setExpandedId(expandedId === t.id ? null : t.id)}
                onToggleHidden={() => toggleHidden(t.id)}
                onRemove={() => removeTab(t.id)}
                onPatch={(patch) => patchTab(t.id, patch)}
                canHide={t.hidden || visibleCount > 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-200 py-1.5 text-[11px] text-slate-500 hover:border-slate-300 hover:bg-slate-50"
        >
          <Plus size={12} /> Add Tab
        </button>
        {pickerOpen && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 space-y-0.5 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
            {allDetailTabs().map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => addTab(def.type)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <def.icon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-slate-700">{def.label}</span>
                  <span className="block truncate text-[10px] text-slate-400">{def.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailTabRow({ formId, tab, expanded, onToggleExpand, onToggleHidden, onRemove, onPatch, canHide }: {
  formId: string
  tab: DetailTabConfig
  expanded: boolean
  onToggleExpand: () => void
  onToggleHidden: () => void
  onRemove: () => void
  onPatch: (patch: Partial<DetailTabConfig>) => void
  canHide: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })
  const def = getDetailTab(tab.type)
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border border-slate-200 bg-white',
        isDragging && 'z-10 opacity-70 shadow-md',
        tab.hidden && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={13} />
        </button>
        {def && <def.icon size={13} className="shrink-0 text-slate-400" />}
        <button type="button" onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-1 text-left">
          <span className="truncate text-[12px] font-medium text-slate-700">{tab.label || def?.label || tab.type}</span>
          {def?.builtin && <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-400">Built-in</span>}
          <ChevronDown size={12} className={cn('ml-auto shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={onToggleHidden}
          disabled={!canHide}
          title={tab.hidden ? 'Show tab' : canHide ? 'Hide tab' : "At least one tab must stay visible"}
          className="shrink-0 text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {tab.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canHide}
          title={canHide ? 'Remove tab' : "At least one tab must stay visible"}
          className="shrink-0 text-slate-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && def && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-slate-600">Label</Label>
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
    </div>
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
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Visibility</p>
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
        <div className="space-y-1">
          <Label className="text-[10px] font-medium text-slate-500">Roles</Label>
          <RoleMultiSelect value={roleIds} onChange={(ids) => onChange({ mode, roleIds: ids, userIds })} />
        </div>
      )}
      {(mode === 'users' || mode === 'roles_or_users') && (
        <div className="space-y-1">
          <Label className="text-[10px] font-medium text-slate-500">People</Label>
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
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <Checkbox
          checked={isConditional}
          onCheckedChange={(v) => onChange(v ? { mode: 'expression', expressionWhen: renderIf?.expressionWhen ?? '' } : { mode: 'always' })}
        />
        <Label className="cursor-pointer text-[12px] font-normal text-slate-600">Only show this tab conditionally</Label>
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
