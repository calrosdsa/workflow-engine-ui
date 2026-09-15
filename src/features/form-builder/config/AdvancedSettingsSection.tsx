// "ADVANCED SETTINGS" block in the field config panel's Logic tab: lists an
// element's named AdvancedSetting rules and opens AddAdvancedSettingDialog
// to create/edit one. Mirrors OptionsEditor.tsx's "list + inline add" shape,
// but each row opens a modal rather than editing inline (settings are
// multi-part: audience, condition tree, action list).

import { useState } from 'react'
import { Plus, Pencil, Trash2, ListChecks } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { AddAdvancedSettingDialog } from './AddAdvancedSettingDialog'
import type { AdvancedSetting, FormElement } from '../schema'

interface AdvancedSettingsSectionProps {
  settings: AdvancedSetting[]
  /** This form's own fields, for the condition builder's field picker. */
  fields: FormElement[]
  onChange: (settings: AdvancedSetting[]) => void
}

export function AdvancedSettingsSection({ settings, fields, onChange }: AdvancedSettingsSectionProps) {
  const t = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editing = settings.find((s) => s.id === editingId)

  const openAdd = () => { setEditingId(null); setDialogOpen(true) }
  const openEdit = (id: string) => { setEditingId(id); setDialogOpen(true) }

  const handleSave = (setting: AdvancedSetting) => {
    const exists = settings.some((s) => s.id === setting.id)
    onChange(exists ? settings.map((s) => (s.id === setting.id ? setting : s)) : [...settings, setting])
  }
  const remove = (id: string) => onChange(settings.filter((s) => s.id !== id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.advanced_settings_title')}</Label>
        <Button variant="outline" size="sm" onClick={openAdd} className="h-6 gap-1 px-2 text-[11px]">
          <Plus size={11} /> {t('common.add')}
        </Button>
      </div>

      {settings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
          {t('form_config.no_advanced_settings')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {settings.map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
              <ListChecks size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[hsl(var(--foreground))]">{s.name || t('form_config.untitled')}</p>
                <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                  {t(`form_config.audience_${s.appliesTo}`)} · {t(s.actions.length === 1 ? 'form_config.setting_action_one' : 'form_config.setting_action_many', { count: s.actions.length })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(s.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                title={t('common.edit')}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
                title={t('common.remove')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddAdvancedSettingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        setting={editing}
        fields={fields}
        onSave={handleSave}
      />
    </div>
  )
}
