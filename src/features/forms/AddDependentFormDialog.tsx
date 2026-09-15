import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ListTree, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { createSection, createParentReferenceField } from '@/features/form-builder/factory'
import { toBuilder, toPayload } from '@/features/form-builder/serialize'
import { iterElements } from '@/features/form-builder/projection'
import type { FormElement } from '@/features/form-builder/schema'
import { formsApi } from './api'
import { useForms, formKeys } from './hooks'

type Relationship = 'one-to-many' | 'one-to-one'

interface AddDependentFormDialogProps {
  /** The form whose "Add Dependent Form" menu item opened this dialog —
   *  preselected as the parent, but the user can pick any other form instead. */
  defaultParentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Links two EXISTING forms into a parent/child relationship — creates
 *  nothing new. Sets the child's parent_form_id and ensures it has a
 *  required Form Reference field pointing back at the parent (adding one if
 *  missing, reusing it if the two forms were already linked before). The
 *  relationship type controls whether that reference field is UNIQUE
 *  (one-to-one: at most one child per parent) or not (one-to-many: the
 *  default — many children can point at the same parent, e.g. many Punch
 *  records for one Employee). */
export function AddDependentFormDialog({ defaultParentId, open, onOpenChange }: AddDependentFormDialogProps) {
  const t = useTranslation()
  const qc = useQueryClient()
  const { data: allForms } = useForms()
  const [parentId, setParentId] = useState(defaultParentId)
  const [childId, setChildId] = useState<string | undefined>(undefined)
  const [relationship, setRelationship] = useState<Relationship>('one-to-many')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync to whichever form's menu triggered this dialog each time it opens.
  useEffect(() => {
    if (open) {
      setParentId(defaultParentId)
      setChildId(undefined)
      setRelationship('one-to-many')
      setError(null)
    }
  }, [open, defaultParentId])

  const parentForm = allForms?.find((f) => f.id === parentId)

  const handleLink = async () => {
    if (!parentId || !childId || !parentForm) return
    setSaving(true)
    setError(null)
    try {
      const child = await formsApi.get(childId)
      const builder = toBuilder(child)
      const wantUnique = relationship === 'one-to-one'

      // Reuse an existing reference field pointing at this exact parent if
      // the two forms were already linked before (e.g. the user is only
      // here to flip one-to-many <-> one-to-one) — otherwise a fresh link
      // would duplicate the field on every re-run of this dialog.
      let existing: FormElement | undefined
      for (const el of iterElements(builder.schema)) {
        if (el.component === 'form' && el.formRef === parentId) { existing = el; break }
      }

      if (existing) {
        existing.unique = wantUnique
      } else {
        const field = createParentReferenceField(parentId, parentForm.name)
        field.unique = wantUnique
        const section = createSection('Info', '1')
        section.columns[0].elements = [field]
        builder.schema.sections = [section, ...builder.schema.sections]
      }

      const payload = { ...toPayload(builder), parent_form_id: parentId }
      await formsApi.update(childId, payload)

      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: formKeys.detail(childId) })
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListTree size={16} /> {t('forms.add_dependent_dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('forms.add_dependent_dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-600">{t('forms.add_dependent_dialog.parent_form')}</label>
            <FormReferenceSelect value={parentId} onChange={(id) => setParentId(id ?? '')} excludeId={childId} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-600">{t('forms.add_dependent_dialog.child_form')}</label>
            <FormReferenceSelect value={childId} onChange={setChildId} excludeId={parentId} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-600">{t('forms.add_dependent_dialog.relationship')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRelationship('one-to-many')}
                className={`flex-1 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                  relationship === 'one-to-many'
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="block font-medium">{t('forms.add_dependent_dialog.one_to_many')}</span>
                <span className="block text-[11px] text-slate-400">{t('forms.add_dependent_dialog.one_to_many_hint')}</span>
              </button>
              <button
                type="button"
                onClick={() => setRelationship('one-to-one')}
                className={`flex-1 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                  relationship === 'one-to-one'
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="block font-medium">{t('forms.add_dependent_dialog.one_to_one')}</span>
                <span className="block text-[11px] text-slate-400">{t('forms.add_dependent_dialog.one_to_one_hint')}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleLink} disabled={!parentId || !childId || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ListTree size={14} />}
            {t('forms.add_dependent_dialog.link_forms')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
