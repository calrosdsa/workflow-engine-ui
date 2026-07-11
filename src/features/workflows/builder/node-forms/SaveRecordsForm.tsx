import { Label } from '@/components/ui/label'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, SaveRecordsConfig } from '../../types'

export function normaliseSaveRecordsConfig(raw: unknown): SaveRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SaveRecordsConfig>
  return {
    source_expr: r.source_expr ?? '',
    form_id:     r.form_id ?? '',
    output_var:  r.output_var ?? '',
    count_var:   r.count_var ?? '',
  }
}

// save_records — bulk upserts a list of records (typically a Transform
// node's "records" output) into a single form in one activity call.
export interface SaveRecordsFormProps {
  config: SaveRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: SaveRecordsConfig) => void
}

export function SaveRecordsForm({ config, variables, nodeContext, onChange }: SaveRecordsFormProps) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const uniqueFields = fields.filter((f) => f.unique)

  const set = (patch: Partial<SaveRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Target form */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Unique-field match info */}
      {config.form_id && (
        uniqueFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-700">
            This form has no unique fields. Mark at least one field unique in the form builder to use save_records.
          </p>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-500">
            Matches on: {uniqueFields.map((f) => f.label || f.name).join(', ')}
          </p>
        )
      )}

      <div className="h-px bg-slate-100" />

      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Records to save</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["transform1"]["records"]'
          label="records to save"
        />
        <p className="text-[10px] text-slate-400">
          Must resolve to a list of records shaped to this form's fields — e.g. a Transform node's <span className="font-mono">records</span> output. All records are upserted in one call.
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        Outputs <span className="font-mono">records</span>, <span className="font-mono">created</span>, <span className="font-mono">updated</span>, and <span className="font-mono">count</span> to downstream nodes.
      </p>
    </div>
  )
}
