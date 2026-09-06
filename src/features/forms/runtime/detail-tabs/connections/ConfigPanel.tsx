// Form Builder-side config UI for the connections tab type. Unlike
// related_form (one target per tab instance), this manages a LIST of
// relationships — so the panel is an existing-entries list plus an
// add-entry row, rather than a single set of pickers.
import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { Field } from '@/features/form-builder/config/ConfigPanel'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useMenus } from '@/features/menus/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfigPanelProps } from '../contract'
import type { ConnectionsEntry, ConnectionsTabConfig } from './schema'
import { connectionKey } from './schema'
import type { SearchMenuConfig } from '@/features/menus/types'

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// Every category string already used by an entry, in first-appearance
// order — the same "unlisted categories append after the named ones, in
// first-appearance order" rule the Renderer itself follows, surfaced here
// so the category-order editor always shows every category that actually
// exists, not just the ones a builder has explicitly ordered so far.
function allCategoriesInOrder(config: ConnectionsTabConfig): string[] {
  const named = config.categoryOrder ?? []
  const seen = new Set(named)
  const rest: string[] = []
  for (const e of config.connections) {
    if (e.category && !seen.has(e.category)) {
      seen.add(e.category)
      rest.push(e.category)
    }
  }
  return [...named, ...rest]
}

function EntryRow({ entry, onChange, onRemove, onMoveUp, onMoveDown }: {
  entry: ConnectionsEntry
  onChange: (next: ConnectionsEntry) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const { data: targetForm } = useFormDef(entry.targetFormId)
  const { data: menus } = useMenus()
  const t = useTranslation()
  const menuOptions = useMemo(
    () => (menus ?? []).filter((m) => m.menu_type === 'search' && (m.config as SearchMenuConfig).form_id === entry.targetFormId),
    [menus, entry.targetFormId],
  )

  return (
    <div className="space-y-2 rounded-md border p-2.5" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>
          {targetForm?.name ?? entry.targetFormId} <span style={{ color: 'hsl(var(--muted-foreground))' }}>via {entry.targetFieldName}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onMoveUp} disabled={!onMoveUp} aria-label="Move up"><ArrowUp size={12} /></Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onMoveDown} disabled={!onMoveDown} aria-label="Move down"><ArrowDown size={12} /></Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={onRemove} aria-label="Remove"><Trash2 size={12} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('connections.config.label_override')}>
          <Input
            className="h-7 text-xs"
            placeholder={targetForm?.name ?? ''}
            value={entry.label ?? ''}
            onChange={(e) => onChange({ ...entry, label: e.target.value || undefined })}
          />
        </Field>
        <Field label={t('connections.config.category')} hint={t('connections.config.category_hint')}>
          <Input
            className="h-7 text-xs"
            placeholder={t('connections.config.category_placeholder')}
            value={entry.category ?? ''}
            onChange={(e) => onChange({ ...entry, category: e.target.value || undefined })}
          />
        </Field>
      </div>

      <Field label={t('connections.config.pick_menu')} hint={t('connections.config.pick_menu_hint')}>
        <SelectMenu
          value={entry.targetMenuId ?? '__none__'}
          onValueChange={(v) => onChange({ ...entry, targetMenuId: v === '__none__' ? undefined : v })}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs">{t('connections.config.pick_menu_none')}</SelectItem>
            {menuOptions.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </Field>

      <Field label={t('connections.config.quick_create_mode')}>
        <SelectMenu
          value={entry.quickCreate ?? 'dialog'}
          onValueChange={(v) => onChange({ ...entry, quickCreate: v as ConnectionsEntry['quickCreate'] })}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dialog" className="text-xs">{t('connections.config.quick_create_dialog')}</SelectItem>
            <SelectItem value="page" className="text-xs">{t('connections.config.quick_create_page')}</SelectItem>
            <SelectItem value="off" className="text-xs">{t('connections.config.quick_create_off')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
    </div>
  )
}

function AddEntryRow({ formId, existingKeys, onAdd }: {
  formId: string
  existingKeys: Set<string>
  onAdd: (entry: ConnectionsEntry) => void
}) {
  const [targetFormId, setTargetFormId] = useState<string | undefined>(undefined)
  const [targetFieldName, setTargetFieldName] = useState<string | undefined>(undefined)
  const { data: targetForm } = useFormDef(targetFormId ?? '')
  const t = useTranslation()

  const validTargetFields = useMemo(
    () => (targetForm?.fields ?? []).filter((f) => f.type === 'reference' && f.reference_table === formId),
    [targetForm, formId],
  )

  const duplicate = !!targetFormId && !!targetFieldName && existingKeys.has(connectionKey({ targetFormId, targetFieldName }))

  return (
    <div className="space-y-2 rounded-md border border-dashed p-2.5" style={{ borderColor: 'hsl(var(--border))' }}>
      <Field label={t('connections.config.pick_form')} hint={t('connections.config.add_form_hint')}>
        <FormReferenceSelect
          value={targetFormId}
          excludeId={formId}
          requireReferenceTo={formId}
          onChange={(id) => { setTargetFormId(id); setTargetFieldName(undefined) }}
        />
      </Field>

      {targetFormId && (
        <Field label={t('connections.config.pick_field')} hint={t('connections.config.pick_field_hint')}>
          {validTargetFields.length === 0 ? (
            <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('connections.config.no_matching_field')}</p>
          ) : (
            <SelectMenu value={targetFieldName} onValueChange={setTargetFieldName}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select a field…" /></SelectTrigger>
              <SelectContent>
                {validTargetFields.map((f) => (
                  <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
          )}
        </Field>
      )}

      {duplicate && <p className="text-[11px] text-red-500">{t('connections.config.duplicate_entry')}</p>}

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        disabled={!targetFormId || !targetFieldName || duplicate}
        onClick={() => {
          if (!targetFormId || !targetFieldName) return
          onAdd({ targetFormId, targetFieldName })
          setTargetFormId(undefined)
          setTargetFieldName(undefined)
        }}
      >
        <Plus size={12} />{t('connections.config.add_connection')}
      </Button>
    </div>
  )
}

export function ConnectionsConfigPanel({ config, onChange, formId }: DetailTabConfigPanelProps<ConnectionsTabConfig>) {
  const existingKeys = useMemo(() => new Set(config.connections.map(connectionKey)), [config.connections])
  const categories = allCategoriesInOrder(config)
  const t = useTranslation()

  return (
    <div className="space-y-3">
      {config.connections.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{t('connections.config.empty_state')}</p>
      ) : (
        <div className="space-y-2">
          {config.connections.map((entry, i) => (
            <EntryRow
              key={connectionKey(entry)}
              entry={entry}
              onChange={(next) => {
                const connections = config.connections.slice()
                connections[i] = next
                onChange({ ...config, connections })
              }}
              onRemove={() => onChange({ ...config, connections: config.connections.filter((_, idx) => idx !== i) })}
              onMoveUp={i > 0 ? () => onChange({ ...config, connections: move(config.connections, i, i - 1) }) : undefined}
              onMoveDown={i < config.connections.length - 1 ? () => onChange({ ...config, connections: move(config.connections, i, i + 1) }) : undefined}
            />
          ))}
        </div>
      )}

      <AddEntryRow
        formId={formId}
        existingKeys={existingKeys}
        onAdd={(entry) => onChange({ ...config, connections: [...config.connections, entry] })}
      />

      {categories.length > 1 && (
        <Field label={t('connections.config.category_order')} hint={t('connections.config.category_order_hint')}>
          <div className="space-y-1">
            {categories.map((cat, i) => (
              <div key={cat} className="flex items-center justify-between rounded border px-2 py-1 text-xs" style={{ borderColor: 'hsl(var(--border))' }}>
                <span>{cat}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="sm" className="h-6 w-6 p-0"
                    disabled={i === 0}
                    onClick={() => onChange({ ...config, categoryOrder: move(categories, i, i - 1) })}
                    aria-label="Move up"
                  ><ArrowUp size={12} /></Button>
                  <Button
                    variant="ghost" size="sm" className="h-6 w-6 p-0"
                    disabled={i === categories.length - 1}
                    onClick={() => onChange({ ...config, categoryOrder: move(categories, i, i + 1) })}
                    aria-label="Move down"
                  ><ArrowDown size={12} /></Button>
                </div>
              </div>
            ))}
          </div>
        </Field>
      )}
    </div>
  )
}
