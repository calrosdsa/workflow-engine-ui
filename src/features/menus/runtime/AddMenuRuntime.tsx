import { useMemo, useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { localizeFormSchema } from '@/features/form-builder/localize-schema'
import { useI18n } from '@/features/i18n/I18nProvider'
import { useAfterSubmitWorkflow } from '@/features/ui-workflows/useAfterSubmitWorkflow'
import type { Menu, AddMenuConfig } from '../types'

interface AddMenuRuntimeProps {
  menu: Menu
  clientId: string
  appId: string
  onNavigate?: (slug: string) => void
}

export function AddMenuRuntime({ menu, onNavigate }: AddMenuRuntimeProps) {
  const config = menu.config as AddMenuConfig
  const { data: form, isLoading } = useFormDef(config.form_id)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  // Bumped after every successful create to force a fresh FormRenderer.
  // FormRenderer owns its values inside react-hook-form and exposes no reset
  // handle, so remounting via `key` is the only way to clear them from out
  // here — and they MUST be cleared: this menu's default config is
  // success_behavior 'message', meaning the user stays on a still-populated
  // form after saving. Clicking Save again (reasonably, to enter the next
  // record) silently wrote an exact duplicate. Bumping unconditionally (not
  // just when staying) is harmless when a redirect fires right after, since
  // this page unmounts before the extra remount would ever paint.
  const [formGeneration, setFormGeneration] = useState(0)

  // Resolved above the early returns below, because the hook that reads it
  // cannot be called conditionally. Both are undefined-tolerant while the
  // form is still loading.
  const { t, tc } = useI18n()
  const schema = useMemo(() => (form ? localizeFormSchema(resolveFormSchema(form), form.id, tc) : undefined), [form, tc])
  const runAfterSubmit = useAfterSubmitWorkflow(form?.id, schema?.settings?.afterSubmitWorkflow)

  if (isLoading) return null
  if (!form) return <div className="p-6 text-sm" style={{ color: 'hsl(var(--destructive))' }}>{t('menus.runtime.add.form_unavailable')}</div>

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    setResult(null)
    try {
      const created = await formsApi.createRecord(form.id, values)
      setResult('success')
      setFormGeneration((n) => n + 1)

      // The form's after-submit steps run here, AFTER the write, and cannot
      // undo it — the record exists by now. Awaited before this menu's own
      // redirect so a workflow that navigates somewhere specific wins over
      // the menu's generic destination; two navigations racing on one click
      // would land the viewer wherever the second happens to resolve.
      const { navigated } = await runAfterSubmit({ ...values, ...created })

      if (!navigated && config.success_behavior === 'redirect' && config.redirect_menu_slug) {
        onNavigate?.(config.redirect_menu_slug)
      }
    } catch {
      setResult('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div>
        <h1 data-slot="page-title" className="text-lg font-semibold text-[hsl(var(--foreground))]">{menu.name}</h1>
      </div>

      {result === 'success' && config.success_behavior === 'message' && (
        <div className="flex items-center gap-2 rounded-md border p-3 text-sm" style={{ borderColor: 'hsl(var(--success) / 0.3)', backgroundColor: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))' }}>
          <CheckCircle2 size={16} />
          {/* Two layers: config.success_message (when the admin authored one)
             or the fixed platform default (already localized via t()) is
             ITSELF the tc() fallback — so a menu with no custom message
             still gets a per-app override hook, keyed the same way a menu's
             own name already is. */}
          {tc(`menu.${menu.id}.success_message`, config.success_message || t('forms.create.success_message'))}
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-center gap-2 rounded-md border p-3 text-sm" style={{ borderColor: 'hsl(var(--destructive) / 0.3)', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
          <AlertCircle size={16} />
          {t('forms.create.error_message')}
        </div>
      )}

      <FormRenderer
        key={formGeneration}
        schema={schema!}
        fields={form.fields}
        formId={form.id}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={t('common.save')}
      />
    </div>
  )
}
