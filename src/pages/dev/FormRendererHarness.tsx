// Throwaway verification harness for FormRenderer (Phase 5 of the App
// Builder) — renders any existing form's schema as a fillable form, outside
// of any menu context, so the renderer can be exercised before Add Menu
// (Phase 6) provides the real integration point. Not linked from any nav;
// reachable only by navigating directly to /dev/form-renderer.
import { useState } from 'react'
import { useForms, useForm } from '@/features/forms/hooks'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { parseLayout } from '@/features/form-builder/serialize'
import { Select } from '@/components/ui/select'

export function FormRendererHarness() {
  const { data: forms } = useForms()
  const [formId, setFormId] = useState('')
  const { data: form } = useForm(formId)
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null)

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">FormRenderer harness</h1>
      <Select value={formId} onChange={(e) => { setFormId(e.target.value); setSubmitted(null) }}>
        <option value="">Select a form…</option>
        {(forms ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </Select>

      {form && (
        <FormRenderer
          schema={parseLayout(form.layout)}
          fields={form.fields}
          onSubmit={(values) => setSubmitted(values)}
          submitLabel="Test submit"
        />
      )}

      {submitted && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-1 text-xs font-semibold text-emerald-700">Submitted values:</p>
          <pre className="text-[11px] text-emerald-800">{JSON.stringify(submitted, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
