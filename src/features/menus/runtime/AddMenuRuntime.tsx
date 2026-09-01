import { useMemo, useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
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
  // success_behavior 'message' with navigate_after_save false, meaning the
  // user stays on a still-populated form after saving. Clicking Save again
  // (reasonably, to enter the next record) silently wrote an exact duplicate.
  const [formGeneration, setFormGeneration] = useState(0)

  // Resolved above the early returns below, because the hook that reads it
  // cannot be called conditionally. Both are undefined-tolerant while the
  // form is still loading.
  const schema = useMemo(() => (form ? resolveFormSchema(form) : undefined), [form])
  const runAfterSubmit = useAfterSubmitWorkflow(form?.id, schema?.settings?.afterSubmitWorkflow)

  if (isLoading) return null
  if (!form) return <div className="p-6 text-sm" style={{ color: 'hsl(var(--destructive))' }}>The form this menu points to is unavailable.</div>

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

      if (!navigated && config.navigate_after_save && config.success_behavior === 'redirect' && config.redirect_menu_slug) {
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
        <h1 className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{menu.name}</h1>
      </div>

      {result === 'success' && config.success_behavior === 'message' && (
        <div className="flex items-center gap-2 rounded-md border p-3 text-sm" style={{ borderColor: 'hsl(var(--success) / 0.3)', backgroundColor: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))' }}>
          <CheckCircle2 size={16} />
          {config.success_message || 'Record created successfully.'}
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-center gap-2 rounded-md border p-3 text-sm" style={{ borderColor: 'hsl(var(--destructive) / 0.3)', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
          <AlertCircle size={16} />
          Something went wrong while saving. Please try again.
        </div>
      )}

      <FormRenderer
        key={formGeneration}
        schema={schema!}
        fields={form.fields}
        formId={form.id}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Save"
      />
    </div>
  )
}
