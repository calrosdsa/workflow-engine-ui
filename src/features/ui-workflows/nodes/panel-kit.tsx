// Small shared bits for node config panels.
//
// A local copy of the form-builder's `Field` rather than an import from
// config/ConfigPanel.tsx: that module pulls in the whole form-builder store,
// the detail-page overlay and the component registry, none of which a node
// panel needs — and importing it here would drag all of it into the runtime
// bundle just to draw a label.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { FieldDef } from '@/features/forms/types'

export function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  )
}

/** Picks one of the attached form's fields.
 *
 *  Falls back to a free-text input when the surface has no field list —
 *  the record-action panel knows its form, but a workflow authored against a
 *  form that failed to load should still be editable rather than presenting
 *  an empty dropdown with no way out. */
export function FieldPicker({ fields, value, onChange }: {
  fields: FieldDef[]
  value: string
  onChange: (next: string) => void
}) {
  const t = useTranslation()
  if (fields.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('ui_workflows.field_picker.field_name_placeholder')}
        className="h-8 font-mono text-[11px]"
      />
    )
  }
  return (
    <SelectMenu value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder={t('ui_workflows.field_picker.pick_field_placeholder')} /></SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name} className="text-[12px]">
            {f.label || f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}
