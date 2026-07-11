import { Label } from '@/components/ui/label'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ValuesEditor } from '../ValuesEditor'
import { ensureValueIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, UpsertRecordsConfig } from '../../types'

export function normaliseUpsertRecordsConfig(raw: unknown): UpsertRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<UpsertRecordsConfig>
  return {
    form_id:    r.form_id ?? '',
    values:     ensureValueIds(r.values),
    output_var: r.output_var ?? '',
  }
}

export interface UpsertRecordsFormProps {
  config: UpsertRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: UpsertRecordsConfig) => void
}

export function UpsertRecordsForm({ config, variables, nodeContext, onChange }: UpsertRecordsFormProps) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const uniqueFields = fields.filter((f) => f.unique)

  const set = (patch: Partial<UpsertRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Unique-field match info */}
      {config.form_id && (
        uniqueFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
            This form has no unique fields. Mark at least one field unique in the form builder to use upsert.
          </p>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500">
            Matches on: {uniqueFields.map((f) => f.label || f.name).join(', ')}
          </p>
        )
      )}

      <div className="h-px bg-slate-100" />

      {/* Values */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Field values</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to set field values.</p>
        ) : (
          <ValuesEditor
            values={config.values}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(values) => set({ values })}
          />
        )}
        <p className="text-[10px] text-slate-400">
          Outputs <span className="font-mono">action</span> ("created" or "updated") and <span className="font-mono">record</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}
