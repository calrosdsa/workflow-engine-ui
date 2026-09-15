// Form Builder-side config UI for the field_ref tab type — a single picker
// listing THIS form's own data-bearing fields (same source list/filter
// DetailsTab already uses for its own read-only rendering), so an admin
// can point a sidebar/zone entry at an existing field without leaving the
// Detail Page config surface.
import { useMemo } from 'react'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Field } from '@/features/form-builder/config/ConfigPanel'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { pickableFields } from './pickable-fields'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfigPanelProps } from '../contract'
import type { FieldRefTabConfig } from './schema'

export function FieldRefConfigPanel({ config, onChange, formId }: DetailTabConfigPanelProps<FieldRefTabConfig>) {
  const t = useTranslation()
  const { data: form } = useFormDef(formId)
  const schema = useMemo(() => (form ? resolveFormSchema(form) : null), [form])
  const options = useMemo(() => pickableFields(schema), [schema])

  return (
    <Field label={t('field_ref.config.field_label')} hint={t('field_ref.config.field_hint')}>
      <SelectMenu value={config.fieldKey || undefined} onValueChange={(v) => onChange({ fieldKey: v })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('field_ref.config.select_a_field_placeholder')} /></SelectTrigger>
        <SelectContent>
          {options.map((el) => (
            <SelectItem key={el.key} value={el.key} className="text-xs">{el.label}</SelectItem>
          ))}
        </SelectContent>
      </SelectMenu>
    </Field>
  )
}
