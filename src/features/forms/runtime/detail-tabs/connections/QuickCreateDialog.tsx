// Inline "+" create flow for a connections tile — never navigates away
// from the record being viewed. Mirrors RuntimeFormCreatePage.tsx's own
// schema resolution/localization exactly, but stays a modal and prefills
// the back-reference field via FormRenderer's existing defaultValues prop.
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormRenderer } from '../../FormRenderer'
import { useForm as useFormDef, useCreateRecord } from '@/features/forms/hooks'
import { connectionCountsKey } from '../../record-detail-hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { localizeFormSchema, localizeFormName } from '@/features/form-builder/localize-schema'
import { useI18n } from '@/features/i18n/I18nProvider'

export function QuickCreateDialog({ formId, recordId, targetFormId, targetFieldName, open, onOpenChange }: {
  /** The OWNING form/record whose counts must be invalidated after create. */
  formId: string
  recordId: string
  targetFormId: string
  targetFieldName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState(false)
  const qc = useQueryClient()
  const { data: form } = useFormDef(targetFormId)
  const createRecord = useCreateRecord(targetFormId)
  const { t, tc } = useI18n()

  const schema = useMemo(() => (form ? localizeFormSchema(resolveFormSchema(form), form.id, tc) : undefined), [form, tc])
  const title = form?.name ? localizeFormName(form.id, form.name, tc) : ''

  const handleSubmit = async (values: Record<string, unknown>) => {
    setError(false)
    try {
      await createRecord.mutateAsync({ ...values, [targetFieldName]: recordId })
      // useCreateRecord's own onSuccess invalidates the TARGET form's record
      // list (formKeys.records(targetFormId)) — a different cache key than
      // this OWNING record's connection counts, which must be invalidated
      // here explicitly or the tile's badge would keep showing the old count.
      qc.invalidateQueries({ queryKey: connectionCountsKey(formId, recordId) })
      onOpenChange(false)
    } catch {
      setError(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('connections.dialog.create_title', { form: title })}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {t('connections.dialog.create_error')}
          </div>
        )}
        {form && schema && (
          <FormRenderer
            schema={schema}
            fields={form.fields}
            formId={form.id}
            defaultValues={{ [targetFieldName]: recordId }}
            onSubmit={handleSubmit}
            submitting={createRecord.isPending}
            submitLabel="Save"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
