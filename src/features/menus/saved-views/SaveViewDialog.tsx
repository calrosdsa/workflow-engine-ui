import { useState } from 'react'
import { LayoutList, LayoutGrid, CalendarDays, Columns3 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { cn } from '@/lib/utils'
import { useRoles } from '@/features/roles/hooks'
import { ColumnsPicker } from './ColumnsPicker'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import type {
  SavedView, SavedViewConfig, SavedViewVisibility, ViewLayout,
  CardLayoutConfig, CalendarLayoutConfig, KanbanLayoutConfig,
} from './types'

const LAYOUTS: { value: ViewLayout; label: string; icon: typeof LayoutList }[] = [
  { value: 'list', label: 'List', icon: LayoutList },
  { value: 'card', label: 'Card', icon: LayoutGrid },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'kanban', label: 'Kanban', icon: Columns3 },
]

// Re-attach UI-only `id` keys to a filter tree that may have come from the
// backend (which stores the stripped, id-less shape) — the identical
// ensureGroupIds/ensureSortIds pattern SearchMenuConfigPanel.tsx and the
// dashboard table widget's ConfigPanel.tsx each keep as their own small,
// local copy rather than a shared helper (see that file's own comment for
// why: both call sites are small enough that a shared abstraction isn't
// worth the coupling).
function ensureGroupIds(g: FilterGroup | undefined): FilterGroup {
  if (!g) return newGroup()
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map((c) => ({ ...c, id: c.id ?? nanoid() })),
    groups: (g.groups ?? []).map((sub) => ensureGroupIds(sub)),
  }
}

function ensureSortIds(sort: SortRule[] | undefined): SortRule[] {
  return (sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() }))
}

interface SaveViewDialogProps {
  open: boolean
  onClose: () => void
  appId: string
  fields: FieldDef[]
  /** The current live filter/sort/columns to seed a NEW view with — ignored
   *  once `editing` is set, since an edit starts from that view's own saved
   *  config instead (so opening "Edit view" on a saved view doesn't silently
   *  overwrite its filter/sort/columns with whatever the table happens to be
   *  showing at that moment). */
  config: SavedViewConfig
  /** Present when editing an existing view; absent when creating a new one
   *  from the current live table state. */
  editing?: SavedView
  onSave: (payload: { name: string; visibility: SavedViewVisibility; visible_role_ids: string[]; is_default: boolean; config: SavedViewConfig }) => void
  saving?: boolean
}

// "Save current as new view" / rename-and-reconfigure drawer (FR-D2-014 §3's
// View-switcher UI element row). Visibility/role/default fields mirror the
// menu editor's own Permission section conventions (permission_mode 'role'
// + required_role_ids) so this reads as the same mechanism, not a new one.
// Built as a Drawer (not a small centered Dialog) to match this app's other
// record-editing surfaces — see pages/team/components/RoleFormDrawer.tsx,
// whose padding/spacing/label conventions this mirrors directly.
export function SaveViewDialog({ open, onClose, appId, fields, config, editing, onSave, saving }: SaveViewDialogProps) {
  const seed = editing?.config ?? config
  const [name, setName] = useState(editing?.name ?? '')
  const [visibility, setVisibility] = useState<SavedViewVisibility>(editing?.visibility ?? 'private')
  const [roleIds, setRoleIds] = useState<string[]>(editing?.visible_role_ids ?? [])
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false)
  const [layout, setLayout] = useState<ViewLayout>(seed.layout ?? 'list')
  const [columns, setColumns] = useState<string[]>(seed.columns ?? [])
  const [filter, setFilter] = useState<FilterGroup>(ensureGroupIds(seed.filter))
  const [sort, setSort] = useState<SortRule[]>(ensureSortIds(seed.sort))
  const [dateField, setDateField] = useState<string>(
    (seed.layout === 'calendar' ? (seed.layout_config as CalendarLayoutConfig)?.dateField : undefined) ?? '',
  )
  const [groupField, setGroupField] = useState<string>(
    (seed.layout === 'kanban' ? (seed.layout_config as KanbanLayoutConfig)?.groupField : undefined) ?? '',
  )
  const { data: roles } = useRoles(appId)

  const dateFields = fields.filter((f) => f.type === 'date' || f.type === 'datetime')
  const groupFields = fields.filter((f) => f.type === 'enum' || f.type === 'reference')

  const layoutNeedsField = layout === 'calendar' ? !dateField : layout === 'kanban' ? !groupField : false
  const canSubmit = name.trim().length > 0 && name.length <= 100 && (visibility !== 'role' || roleIds.length > 0) && !layoutNeedsField

  const toggleRole = (id: string) => {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const submit = () => {
    if (!canSubmit) return
    const layout_config: SavedViewConfig['layout_config'] =
      layout === 'calendar' ? ({ dateField } satisfies CalendarLayoutConfig)
      : layout === 'kanban' ? ({ groupField } satisfies KanbanLayoutConfig)
      : undefined
    onSave({
      name: name.trim(), visibility, visible_role_ids: visibility === 'role' ? roleIds : [], is_default: isDefault,
      config: { filter, sort, columns, layout, layout_config },
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <DrawerTitle>{editing ? 'Edit view' : 'Save current as new view'}</DrawerTitle>
          <DrawerDescription>
            {editing
              ? 'Update this view’s name, columns, filter, sort, layout, or visibility.'
              : 'Saves a named, reusable combination of columns, filter, sort, and layout.'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name this view *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My open tasks" maxLength={100} autoFocus />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Layout</label>
            <div className="grid grid-cols-4 gap-1.5">
              {LAYOUTS.map((l) => {
                const disabled = (l.value === 'calendar' && dateFields.length === 0) || (l.value === 'kanban' && groupFields.length === 0)
                return (
                  <button
                    key={l.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setLayout(l.value)}
                    title={disabled ? `No ${l.value === 'calendar' ? 'date/datetime' : 'enum/reference'} field on this form` : undefined}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors',
                      disabled && 'cursor-not-allowed border-gray-200 opacity-40',
                      !disabled && layout === l.value && 'border-indigo-400 bg-indigo-50 text-indigo-700',
                      !disabled && layout !== l.value && 'border-gray-200 text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <l.icon size={16} />
                    {l.label}
                  </button>
                )
              })}
            </div>
          </div>

          {layout === 'calendar' && (
            <div className="rounded-md border border-gray-200 p-2">
              <FieldPicker label="Date field" fields={dateFields} value={dateField} onChange={(v) => setDateField(v ?? '')} required />
            </div>
          )}

          {layout === 'kanban' && (
            <div className="rounded-md border border-gray-200 p-2">
              <FieldPicker label="Group by field" fields={groupFields} value={groupField} onChange={(v) => setGroupField(v ?? '')} required />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Columns</label>
            <ColumnsPicker fields={fields} columns={columns} onChange={setColumns} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Filter</label>
            <FilterBuilder group={filter} fields={fields} variables={[]} onChange={setFilter} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Sort</label>
            <SortRuleList
              rules={sort}
              fields={fields.map((f) => ({ name: f.name, label: f.label }))}
              onChange={setSort}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Visibility</label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
                Private — only you see this view
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="visibility" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
                Public — every viewer of this menu sees this view
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="visibility" checked={visibility === 'role'} onChange={() => setVisibility('role')} />
                Specific roles — only members holding these roles see this view
              </label>
            </div>
          </div>

          {visibility === 'role' && (
            <div className="space-y-1.5 rounded-md border border-gray-200 p-2">
              {(roles ?? []).length === 0 && <p className="text-xs text-gray-400">No roles found for this app.</p>}
              {(roles ?? []).map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <Checkbox checked={roleIds.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} />
                  {r.name}
                </label>
              ))}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <Checkbox checked={isDefault} onCheckedChange={(c) => setIsDefault(!!c)} />
            Make this the default view {visibility === 'private' ? '(for you)' : visibility === 'role' ? '(for these roles)' : '(for everyone)'}
          </label>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving && <Spinner className="h-4 w-4" />}
            {editing ? 'Save changes' : 'Save view'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function FieldPicker({ label, fields, value, onChange, required }: {
  label: string
  fields: FieldDef[]
  value: string | undefined
  onChange: (v: string | undefined) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
      <select
        value={value ?? '__none__'}
        onChange={(e) => onChange(e.target.value === '__none__' ? undefined : e.target.value)}
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
      >
        {!required && <option value="__none__">None</option>}
        {fields.map((f) => (
          <option key={f.name} value={f.name}>{f.label || f.name}</option>
        ))}
      </select>
    </div>
  )
}

function SortRuleList({ rules, fields, onChange }: {
  rules: SortRule[]
  fields: { name: string; label: string }[]
  onChange: (rules: SortRule[]) => void
}) {
  const addRule = () => onChange([...rules, { id: nanoid(), field: fields[0]?.name ?? '', dir: 'asc' }])
  const updateRule = (id: string, patch: Partial<SortRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRule = (id: string) => onChange(rules.filter((r) => r.id !== id))

  return (
    <div className="space-y-1.5">
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-1.5">
          <select
            value={r.field}
            onChange={(e) => updateRule(r.id, { field: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700"
          >
            {fields.map((f) => (
              <option key={f.name} value={f.name}>{f.label || f.name}</option>
            ))}
          </select>
          <select
            value={r.dir}
            onChange={(e) => updateRule(r.id, { dir: e.target.value as 'asc' | 'desc' })}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button
            type="button"
            onClick={() => removeRule(r.id)}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] text-gray-400 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="w-full rounded-md border border-dashed border-gray-200 py-1 text-[11px] text-gray-500 hover:border-gray-300"
      >
        + Sort rule
      </button>
    </div>
  )
}
