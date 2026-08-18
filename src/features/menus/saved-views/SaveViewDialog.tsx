import { useState } from 'react'
import { LayoutList, LayoutGrid, CalendarDays, Columns3 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { cn } from '@/lib/utils'
import { useRoles } from '@/features/roles/hooks'
import type { FieldDef } from '@/features/forms/types'
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

interface SaveViewDialogProps {
  open: boolean
  onClose: () => void
  appId: string
  fields: FieldDef[]
  /** The current live filter/sort/columns to save (a new view) or update
   *  (editing) — this dialog additionally lets the viewer pick the view's
   *  layout and layout-specific config; filter/sort/columns themselves come
   *  from whatever the caller is currently looking at, unchanged here. */
  config: SavedViewConfig
  /** Present when editing an existing view; absent when creating a new one
   *  from the current live table state. */
  editing?: SavedView
  onSave: (payload: { name: string; visibility: SavedViewVisibility; visible_role_ids: string[]; is_default: boolean; config: SavedViewConfig }) => void
  saving?: boolean
}

// "Save current as new view" / rename-and-reconfigure dialog (FR-D2-014 §3's
// View-switcher UI element row). Visibility/role/default fields mirror the
// menu editor's own Permission section conventions (permission_mode 'role'
// + required_role_ids) so this reads as the same mechanism, not a new one.
// Layout picker restricts Calendar to date/datetime fields and Kanban to
// enum/reference fields, per §3's Calendar/Kanban element rows — a form
// with no compatible field simply can't offer that layout option.
export function SaveViewDialog({ open, onClose, appId, fields, config, editing, onSave, saving }: SaveViewDialogProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [visibility, setVisibility] = useState<SavedViewVisibility>(editing?.visibility ?? 'private')
  const [roleIds, setRoleIds] = useState<string[]>(editing?.visible_role_ids ?? [])
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false)
  const [layout, setLayout] = useState<ViewLayout>(editing?.config.layout ?? config.layout ?? 'list')
  const [cardConfig, setCardConfig] = useState<CardLayoutConfig>(
    (editing?.config.layout === 'card' ? editing.config.layout_config as CardLayoutConfig : undefined) ?? {},
  )
  const [dateField, setDateField] = useState<string>(
    (editing?.config.layout === 'calendar' ? (editing.config.layout_config as CalendarLayoutConfig)?.dateField : undefined) ?? '',
  )
  const [groupField, setGroupField] = useState<string>(
    (editing?.config.layout === 'kanban' ? (editing.config.layout_config as KanbanLayoutConfig)?.groupField : undefined) ?? '',
  )
  const { data: roles } = useRoles(appId)

  const dateFields = fields.filter((f) => f.type === 'date' || f.type === 'datetime')
  const groupFields = fields.filter((f) => f.type === 'enum' || f.type === 'reference')
  const textFields = fields.filter((f) => f.type === 'string' || f.type === 'text' || f.type === 'email' || f.type === 'phone')

  const layoutNeedsField = layout === 'calendar' ? !dateField : layout === 'kanban' ? !groupField : false
  const canSubmit = name.trim().length > 0 && name.length <= 100 && (visibility !== 'role' || roleIds.length > 0) && !layoutNeedsField

  const toggleRole = (id: string) => {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const submit = () => {
    if (!canSubmit) return
    const layout_config =
      layout === 'card' ? cardConfig
      : layout === 'calendar' ? ({ dateField } satisfies CalendarLayoutConfig)
      : layout === 'kanban' ? ({ groupField } satisfies KanbanLayoutConfig)
      : undefined
    onSave({
      name: name.trim(), visibility, visible_role_ids: visibility === 'role' ? roleIds : [], is_default: isDefault,
      config: { ...config, layout, layout_config },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit view' : 'Save current as new view'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update this view’s name, visibility, layout, or default status.'
              : 'Saves the current filter, sort, and columns as a reusable named view.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-name">Name</Label>
            <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My open tasks" maxLength={100} autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Layout</Label>
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
                      disabled && 'cursor-not-allowed opacity-40',
                      !disabled && layout === l.value && 'border-[hsl(var(--primary))] bg-[hsl(var(--accent))]',
                      !disabled && layout !== l.value && 'hover:bg-[hsl(var(--accent))]',
                    )}
                    style={{ borderColor: layout === l.value && !disabled ? undefined : 'hsl(var(--border))' }}
                  >
                    <l.icon size={16} />
                    {l.label}
                  </button>
                )
              })}
            </div>
          </div>

          {layout === 'card' && (
            <div className="flex flex-col gap-2 rounded-md border p-2" style={{ borderColor: 'hsl(var(--border))' }}>
              <FieldPicker label="Title field (optional — defaults to the record's title)" fields={fields} value={cardConfig.titleField} onChange={(v) => setCardConfig((c) => ({ ...c, titleField: v }))} />
              <FieldPicker label="Subtitle field (optional)" fields={textFields} value={cardConfig.subtitleField} onChange={(v) => setCardConfig((c) => ({ ...c, subtitleField: v }))} />
            </div>
          )}

          {layout === 'calendar' && (
            <div className="flex flex-col gap-1.5 rounded-md border p-2" style={{ borderColor: 'hsl(var(--border))' }}>
              <FieldPicker label="Date field" fields={dateFields} value={dateField} onChange={(v) => setDateField(v ?? '')} required />
            </div>
          )}

          {layout === 'kanban' && (
            <div className="flex flex-col gap-1.5 rounded-md border p-2" style={{ borderColor: 'hsl(var(--border))' }}>
              <FieldPicker label="Group by field" fields={groupFields} value={groupField} onChange={(v) => setGroupField(v ?? '')} required />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Visibility</Label>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as SavedViewVisibility)} className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="private" /> Private — only you see this view
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="public" /> Public — every viewer of this menu sees this view
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="role" /> Specific roles — only members holding these roles see this view
              </label>
            </RadioGroup>
          </div>

          {visibility === 'role' && (
            <div className="flex flex-col gap-1.5 rounded-md border p-2" style={{ borderColor: 'hsl(var(--border))' }}>
              {(roles ?? []).length === 0 && <p className="text-xs text-slate-400">No roles found for this app.</p>}
              {(roles ?? []).map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={roleIds.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} />
                  {r.name}
                </label>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(c) => setIsDefault(!!c)} />
            Make this the default view {visibility === 'private' ? '(for you)' : visibility === 'role' ? '(for these roles)' : '(for everyone)'}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save view'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <SelectMenu value={value ?? '__none__'} onValueChange={(v) => onChange(v === '__none__' ? undefined : v)}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a field…" /></SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="__none__" className="text-xs">None</SelectItem>}
          {fields.map((f) => (
            <SelectItem key={f.name} value={f.name} className="text-xs">{f.label}</SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
    </div>
  )
}
