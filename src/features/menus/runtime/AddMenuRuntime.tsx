import { useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { parseLayout } from '@/features/form-builder/serialize'
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

  if (isLoading) return null
  if (!form) return <div className="p-6 text-sm text-red-600">The form this menu points to is unavailable.</div>

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    setResult(null)
    try {
      await formsApi.createRecord(form.id, values)
      setResult('success')
      if (config.navigate_after_save && config.success_behavior === 'redirect' && config.redirect_menu_slug) {
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
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} />
          {config.success_message || 'Record created successfully.'}
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} />
          Something went wrong while saving. Please try again.
        </div>
      )}

      <FormRenderer
        schema={parseLayout(form.layout)}
        fields={form.fields}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Save"
      />
    </div>
  )
}
