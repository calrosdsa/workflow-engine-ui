import { useState } from 'react'
import { LayoutList, LayoutGrid, CalendarDays, Columns3, ListTree } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { useCurrentUserAttrs } from '@/features/workflows/builder/useCurrentUserAttrs'
import { SortRuleList } from '@/components/ui/sort-rule-list'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { cn } from '@/lib/utils'
import { useRoles } from '@/features/roles/hooks'
import { useTranslation, type I18nContextValue } from '@/features/i18n/I18nProvider'
import { ColumnsPicker } from './ColumnsPicker'
import { KanbanColumnsPicker } from './KanbanColumnsPicker'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup, SortRule } from '@/features/workflows/types'
import { SYSTEM_FIELDS } from './types'
import type {
  SavedView, SavedViewConfig, SavedViewVisibility, ViewLayout,
  CalendarLayoutConfig, KanbanLayoutConfig, TreeLayoutConfig,
} from './types'

// Layout names double as the picker's own labels AND the vars composed into
// disabled_reason/disabled_title below — one t() per layout, not a separate
// English literal at each of the three use sites.
function layoutLabels(t: I18nContextValue['t']): Record<ViewLayout, string> {
  return {
    list: t('menus.saved_views.dialog.layout_list'),
    card: t('menus.saved_views.dialog.layout_card'),
    calendar: t('menus.saved_views.dialog.layout_calendar'),
    kanban: t('menus.saved_views.dialog.layout_kanban'),
    tree: t('menus.saved_views.dialog.layout_tree'),
  }
}

function buildLayouts(labels: Record<ViewLayout, string>): { value: ViewLayout; label: string; icon: typeof LayoutList }[] {
  return [
    { value: 'list', label: labels.list, icon: LayoutList },
    { value: 'card', label: labels.card, icon: LayoutGrid },
    { value: 'calendar', label: labels.calendar, icon: CalendarDays },
    { value: 'kanban', label: labels.kanban, icon: Columns3 },
    { value: 'tree', label: labels.tree, icon: ListTree },
  ]
}

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
  /** The menu's own underlying form id — used only to filter Tree's parent-
   *  field picker down to genuinely self-referential reference fields (see
   *  TreeLayoutConfig's own doc comment for why a field pointing at a
   *  DIFFERENT form can't produce a hierarchy over this menu's records). */
  formId: string
  fields: FieldDef[]
  /** field name -> (stored value -> display label), for the group field's
   *  Kanban column picker — same map RecordsTable already builds for List/
   *  Card's own enum-value display (see enum-labels.ts), threaded through
   *  here so a Kanban column shows "Active," not "active," in this picker
   *  too, not just on the board itself. */
  enumLabels: Map<string, Map<string, string>>
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
// Built as a Drawer (not a small centered Dialog) for record-editing-surface
// consistency, but themed via hsl(var(--...)) tokens throughout (matching
// RecordDetailPanel.tsx/RecordsTable.tsx's own runtime-drawer convention),
// NOT the App Builder shell's light-only gray-scale classes (e.g.
// RoleFormDrawer.tsx) — this drawer renders inside the runtime app, which is
// themeable (light/dark), unlike the builder shell.
export function SaveViewDialog({ open, onClose, appId, formId, fields, enumLabels, config, editing, onSave, saving }: SaveViewDialogProps) {
  const t = useTranslation()
  const seed = editing?.config ?? config
  const [name, setName] = useState(editing?.name ?? '')
  const [visibility, setVisibility] = useState<SavedViewVisibility>(editing?.visibility ?? 'private')
  const [roleIds, setRoleIds] = useState<string[]>(editing?.visible_role_ids ?? [])
  const [isDefault, setIsDefault] = useState(editing?.is_default ?? false)
  const [layout, setLayout] = useState<ViewLayout>(seed.layout ?? 'list')
  const [columns, setColumns] = useState<string[]>(seed.columns ?? [])
  const viewerModes = useCurrentUserAttrs()
  const [filter, setFilter] = useState<FilterGroup>(ensureGroupIds(seed.filter))
  const [sort, setSort] = useState<SortRule[]>(ensureSortIds(seed.sort))
  const [dateField, setDateField] = useState<string>(
    (seed.layout === 'calendar' ? (seed.layout_config as CalendarLayoutConfig)?.dateField : undefined) ?? '',
  )
  const [groupField, setGroupField] = useState<string>(
    (seed.layout === 'kanban' ? (seed.layout_config as KanbanLayoutConfig)?.groupField : undefined) ?? '',
  )
  const [kanbanVisibleColumns, setKanbanVisibleColumns] = useState<string[]>(
    (seed.layout === 'kanban' ? (seed.layout_config as KanbanLayoutConfig)?.visibleColumns : undefined) ?? [],
  )
  const [parentField, setParentField] = useState<string>(
    (seed.layout === 'tree' ? (seed.layout_config as TreeLayoutConfig)?.parentField : undefined) ?? '',
  )
  const [treeGroupField, setTreeGroupField] = useState<string>(
    (seed.layout === 'tree' ? (seed.layout_config as TreeLayoutConfig)?.groupField : undefined) ?? '',
  )
  const { data: roles } = useRoles(appId)

  // Created At / Last Modified are pickable everywhere a real form field
  // is — columns, filter, sort, and (since both are datetimes) Calendar's
  // own date-field picker — without the form needing a real date field of
  // its own.
  const fieldsWithSystem = [...fields, ...SYSTEM_FIELDS]
  const dateFields = fieldsWithSystem.filter((f) => f.type === 'date' || f.type === 'datetime')
  // Kanban grouping is Select-fields-only — a reference field's distinct
  // values are an unbounded, paginated set of foreign records rather than a
  // small fixed set of columns, which would make drag-to-recolumn an
  // open-ended target picker instead of the fixed board Kanban is meant to
  // be (see KanbanLayout.tsx's own top comment for the full reasoning).
  const groupFields = fields.filter((f) => f.type === 'enum')
  const groupFieldDef = fields.find((f) => f.name === groupField)
  const kanbanColumnOptions = (groupFieldDef?.enum_values ?? []).map((v) => ({
    value: v,
    label: enumLabels.get(groupField)?.get(v) ?? v,
  }))
  // Tree's parent field must be self-referential — a reference field whose
  // reference_table is THIS form's own id — since only that can produce a
  // hierarchy over this menu's own records (see TreeLayoutConfig). The
  // group/folder field is unrestricted beyond its type: any boolean field,
  // purely for the icon (see that config key's own doc comment).
  const treeParentFields = fields.filter((f) => f.type === 'reference' && f.reference_table === formId)
  const treeGroupFields = fields.filter((f) => f.type === 'boolean')
  const labels = layoutLabels(t)
  const layouts = buildLayouts(labels)
  const fieldKinds = {
    calendar: t('menus.saved_views.dialog.field_kind_date'),
    kanban: t('menus.saved_views.dialog.field_kind_select'),
    tree: t('menus.saved_views.dialog.field_kind_reference'),
  }
  // A native `disabled` button drops out of the tab order — a keyboard
  // user can never focus one to read its title attribute, so the reason
  // needs an always-visible home too (rendered beneath the picker grid).
  // Tree gets its own full sentence, not the shared template: the original
  // copy explained self-referencing with a trailing clause ("one whose
  // target is this same form") that doesn't fit the generic {{layout}}
  // needs a {{kind}} field shape without also polluting field_kind_reference
  // (which the title tooltip below reuses, where that clause would read
  // as a mid-sentence aside).
  const disabledLayoutReasons = [
    dateFields.length === 0 && t('menus.saved_views.dialog.disabled_reason', { layout: labels.calendar, kind: fieldKinds.calendar }),
    groupFields.length === 0 && t('menus.saved_views.dialog.disabled_reason', { layout: labels.kanban, kind: fieldKinds.kanban }),
    treeParentFields.length === 0 && t('menus.saved_views.dialog.disabled_reason_tree'),
  ].filter((r): r is string => !!r)

  const layoutNeedsField = layout === 'calendar' ? !dateField : layout === 'kanban' ? !groupField : layout === 'tree' ? !parentField : false
  const canSubmit = name.trim().length > 0 && name.length <= 100 && (visibility !== 'role' || roleIds.length > 0) && !layoutNeedsField

  const toggleRole = (id: string) => {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  const submit = () => {
    if (!canSubmit) return
    const layout_config: SavedViewConfig['layout_config'] =
      layout === 'calendar' ? ({ dateField } satisfies CalendarLayoutConfig)
      : layout === 'kanban' ? ({ groupField, visibleColumns: kanbanVisibleColumns } satisfies KanbanLayoutConfig)
      : layout === 'tree' ? ({ parentField, groupField: treeGroupField || undefined } satisfies TreeLayoutConfig)
      : undefined
    onSave({
      name: name.trim(), visibility, visible_role_ids: visibility === 'role' ? roleIds : [], is_default: isDefault,
      config: { filter, sort, columns, layout, layout_config },
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg" container={document.getElementById('runtime-root')}>
        <DrawerHeader>
          <DrawerTitle>{editing ? t('menus.saved_views.edit_view') : t('menus.saved_views.save_as_new')}</DrawerTitle>
          <DrawerDescription>
            {editing
              ? t('menus.saved_views.dialog.description_edit')
              : t('menus.saved_views.dialog.description_create')}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <FieldLabel>{t('menus.saved_views.dialog.name_label')}</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('menus.saved_views.dialog.name_placeholder')} maxLength={100} autoFocus />
          </div>

          <div>
            <FieldLabel>{t('menus.saved_views.dialog.layout_label')}</FieldLabel>
            <div className="grid grid-cols-5 gap-1.5">
              {layouts.map((l) => {
                const disabled = (l.value === 'calendar' && dateFields.length === 0) || (l.value === 'kanban' && groupFields.length === 0) || (l.value === 'tree' && treeParentFields.length === 0)
                const selected = !disabled && layout === l.value
                return (
                  <button
                    key={l.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setLayout(l.value)
                      // A required <select> with no matching value falls
                      // back to showing its first <option> VISUALLY while
                      // React's own controlled value stays '' — the classic
                      // controlled-select-with-no-matching-option trap. Found
                      // live: switching to Kanban showed "Status" selected
                      // (the form's only enum field) but Save stayed
                      // disabled, because groupField was still '' underneath
                      // — the picker never actually synced what the browser
                      // was showing back into state. Defaulting explicitly
                      // here, on every switch into a field-needing layout,
                      // keeps what's displayed and what's submitted the same
                      // thing instead of relying on a user's own change event
                      // to first establish it.
                      if (l.value === 'calendar' && !dateField && dateFields[0]) setDateField(dateFields[0].name)
                      if (l.value === 'kanban' && !groupField && groupFields[0]) setGroupField(groupFields[0].name)
                      if (l.value === 'tree' && !parentField && treeParentFields[0]) setParentField(treeParentFields[0].name)
                    }}
                    title={disabled ? t('menus.saved_views.dialog.disabled_title', { kind: l.value === 'calendar' ? fieldKinds.calendar : l.value === 'tree' ? fieldKinds.tree : fieldKinds.kanban }) : undefined}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors',
                      disabled && 'cursor-not-allowed opacity-40',
                      !disabled && !selected && 'hover:bg-[hsl(var(--accent))]',
                    )}
                    style={{
                      borderColor: selected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      backgroundColor: selected ? 'hsl(var(--accent))' : 'transparent',
                      color: selected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                    }}
                  >
                    <l.icon size={16} />
                    {l.label}
                  </button>
                )
              })}
            </div>
            {/* Always-visible, not hover-only: a native `disabled` button
               drops out of the tab order entirely, so a keyboard user can
               never focus one to discover why via its title attribute — a
               plain-language summary beneath the grid is the only way
               every visitor, not just a mouse-hovering one, learns why an
               option is greyed out. */}
            {disabledLayoutReasons.length > 0 && (
              <p className="mt-1.5 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{disabledLayoutReasons.join(' ')}</p>
            )}
          </div>

          {layout === 'calendar' && (
            <div className="space-y-3">
              <FieldPicker label={t('menus.saved_views.dialog.date_field_label')} fields={dateFields} value={dateField} onChange={(v) => setDateField(v ?? '')} required />
            </div>
          )}

          {layout === 'tree' && (
            <div className="space-y-3">
              <FieldPicker
                label={t('menus.saved_views.dialog.parent_field_label')}
                fields={treeParentFields}
                value={parentField}
                onChange={(v) => setParentField(v ?? '')}
                required
              />
              <div>
                <FieldPicker
                  label={t('menus.saved_views.dialog.group_field_label')}
                  fields={treeGroupFields}
                  value={treeGroupField}
                  onChange={(v) => setTreeGroupField(v ?? '')}
                />
                <p className="mt-1 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {t('menus.saved_views.dialog.group_field_hint')}
                </p>
              </div>
            </div>
          )}

          {layout === 'kanban' && (
            <div className="space-y-3">
              <FieldPicker
                label={t('menus.saved_views.dialog.group_by_field_label')}
                fields={groupFields}
                value={groupField}
                onChange={(v) => {
                  // A saved visibleColumns list names one field's enum
                  // values — switching to a DIFFERENT group field makes it
                  // meaningless (its values wouldn't even be real options
                  // for the new field), so this resets to "show every
                  // column" rather than silently carrying over a stale,
                  // unrelated filter.
                  setGroupField(v ?? '')
                  setKanbanVisibleColumns([])
                }}
                required
              />
              {groupFieldDef && (
                <div>
                  <FieldLabel>{t('menus.saved_views.dialog.columns_label')}</FieldLabel>
                  <KanbanColumnsPicker
                    options={kanbanColumnOptions}
                    visibleColumns={kanbanVisibleColumns}
                    onVisibleColumnsChange={setKanbanVisibleColumns}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <FieldLabel>{t('menus.saved_views.dialog.columns_label')}</FieldLabel>
            <ColumnsPicker fields={fieldsWithSystem} columns={columns} onChange={setColumns} />
          </div>

          <div>
            <FieldLabel>{t('menus.saved_views.dialog.filter_label')}</FieldLabel>
            {/* viewerModes (not hideExpressions — it takes precedence and
               implies the same collapsed, no-expression layout): a saved
               view's filter is end-user-facing config, not workflow-canvas
               scripting — Expr access (Vars[...], NodeOutputs[...]) has no
               meaning for "when should this view's rows be included" — but
               a value can still come from the current user's own account
               record ("Owner = current user", the same "my records" case
               the menu's own default filter offers). overflow-x-auto
               matches RecordsTable's own filter popover: the collapsed
               condition row has a min-width floor (FilterBuilder.tsx) so
               Field/Value stop getting squeezed as controls stack up —
               scrolling only this section horizontally, rather than the
               whole drawer body, keeps Name/Columns/Sort/Visibility
               unaffected. */}
            <div className="overflow-x-auto">
              <FilterBuilder group={filter} fields={fieldsWithSystem} variables={[]} onChange={setFilter} viewerModes={viewerModes} />
            </div>
          </div>

          <div>
            <FieldLabel>{t('menus.saved_views.dialog.sort_label')}</FieldLabel>
            <SortRuleList
              rules={sort}
              fields={fieldsWithSystem.map((f) => ({ name: f.name, label: f.label }))}
              onChange={setSort}
            />
          </div>

          <div>
            <FieldLabel>{t('menus.saved_views.dialog.visibility_label')}</FieldLabel>
            <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as SavedViewVisibility)} className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
                <RadioGroupItem value="private" /> {t('menus.saved_views.dialog.visibility_private')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
                <RadioGroupItem value="public" /> {t('menus.saved_views.dialog.visibility_public')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
                <RadioGroupItem value="role" /> {t('menus.saved_views.dialog.visibility_role')}
              </label>
            </RadioGroup>
          </div>

          {visibility === 'role' && (
            <div className="space-y-1.5">
              {(roles ?? []).length === 0 && <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('menus.saved_views.dialog.no_roles')}</p>}
              {(roles ?? []).map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
                  <Checkbox checked={roleIds.includes(r.id)} onCheckedChange={() => toggleRole(r.id)} />
                  {r.name}
                </label>
              ))}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
            <Checkbox checked={isDefault} onCheckedChange={(c) => setIsDefault(!!c)} />
            {t('menus.saved_views.dialog.default_view_label')} {visibility === 'private' ? t('menus.saved_views.dialog.default_scope_you') : visibility === 'role' ? t('menus.saved_views.dialog.default_scope_roles') : t('menus.saved_views.dialog.default_scope_everyone')}
          </label>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving && <Spinner className="h-4 w-4" />}
            {editing ? t('menus.saved_views.dialog.save_changes') : t('menus.saved_views.dialog.save_view')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{children}</label>
}

function FieldPicker({ label, fields, value, onChange, required }: {
  label: string
  fields: FieldDef[]
  value: string | undefined
  onChange: (v: string | undefined) => void
  required?: boolean
}) {
  const t = useTranslation()
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</label>
      <Select
        value={value ?? '__none__'}
        onChange={(e) => onChange(e.target.value === '__none__' ? undefined : e.target.value)}
        className="h-8 text-xs"
      >
        {!required && <option value="__none__">{t('menus.saved_views.dialog.field_none')}</option>}
        {fields.map((f) => (
          <option key={f.name} value={f.name}>{f.label || f.name}</option>
        ))}
      </Select>
    </div>
  )
}

