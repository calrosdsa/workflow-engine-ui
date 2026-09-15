// Picks which existing TypeReference field on an ADOPTED form points back at
// the parent form embedding it as a Line Items grid. Mirrors
// DisplayFieldSelect's shape exactly, but filters to 'reference'-type fields
// that specifically target parentFormId — not just any reference field on
// the form, which could point at a completely unrelated third form.
import { useEffect, useMemo } from 'react'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useForm as useFormDef } from '@/features/forms/hooks'

interface AdoptedReferenceFieldSelectProps {
  /** The adopted form's id (element.adoptedFormRef). */
  formId?: string
  /** The parent form embedding this grid — only reference fields pointing at
   *  this id are valid candidates. */
  parentFormId?: string
  /** The currently configured reference field name (element.adoptedReferenceField). */
  value?: string
  onChange: (fieldName: string | undefined) => void
}

export function AdoptedReferenceFieldSelect({ formId, parentFormId, value, onChange }: AdoptedReferenceFieldSelectProps) {
  const t = useTranslation()
  const { data: targetForm, isLoading } = useFormDef(formId ?? '')

  const options = useMemo(
    () => (targetForm?.fields ?? []).filter((f) => f.type === 'reference' && f.reference_table === parentFormId),
    [targetForm, parentFormId],
  )

  // A form nested via "Add Dependent Form" always gets exactly one
  // back-reference field auto-injected — the common case by construction
  // now that the Line Items form picker only offers genuine dependents.
  // Auto-filling it here turns the new two-step flow (nest, then adopt)
  // into effectively one click on the second step; still a real picker
  // (not hidden) for the rarer case of more than one candidate.
  useEffect(() => {
    if (!value && !isLoading && options.length === 1) {
      onChange(options[0].name)
    }
  }, [value, isLoading, options, onChange])

  if (!formId) {
    return (
      <SelectMenu disabled>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('form_config.select_a_form_first')} /></SelectTrigger>
        <SelectContent />
      </SelectMenu>
    )
  }

  if (!isLoading && options.length === 0) {
    return (
      <SelectMenu disabled>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('form_config.no_backreference_field')} /></SelectTrigger>
        <SelectContent />
      </SelectMenu>
    )
  }

  return (
    <SelectMenu value={value ?? ''} onValueChange={(v) => onChange(v || undefined)} disabled={isLoading}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={isLoading ? t('form_config.loading_fields') : t('form_config.select_reference_field')} />
      </SelectTrigger>
      <SelectContent>
        {options.map((f) => (
          <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}
