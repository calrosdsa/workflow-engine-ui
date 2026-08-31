import { Label } from '@/components/ui/label'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ValuesEditor } from '../ValuesEditor'
import { ensureMappingIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, TransformConfig, TransformFieldMap } from '../../types'

export function normaliseTransformConfig(raw: unknown): TransformConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TransformConfig>
  return {
    source_expr: r.source_expr ?? '',
    form_id:     r.form_id ?? '',
    mappings:    ensureMappingIds(r.mappings),
    output_var:  r.output_var ?? '',
  }
}

// transform — maps a source list into a target form's schema. Mapping rows
// reuse ValuesEditor (TransformFieldMap and FieldValue share the same
// {id, field, value_mode, value, expression} shape), but expressions here
// evaluate once per SOURCE ITEM with that item's own fields overlaid into
// scope — e.g. an expression of just `Email` reads the current item's Email
// field directly, not Vars["item"]["Email"].
export interface TransformFormProps {
  config: TransformConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: TransformConfig) => void
}

export function TransformForm({ config, variables, nodeContext, onChange }: TransformFormProps) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<TransformConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Source List</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["fetch1"]["records"]'
          label="source list"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Must resolve to a list of records. Runs once per item.</p>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Target form */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Target Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Field mappings */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Field mappings</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">Select a target form to map fields.</p>
        ) : (
          <ValuesEditor
            values={config.mappings}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(mappings) => set({ mappings: mappings as TransformFieldMap[] })}
          />
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Expressions evaluate per source item — reference the item's own fields directly (e.g. <span className="font-mono">Email</span>), not through <span className="font-mono">Vars</span>.
        </p>
      </div>

      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Outputs <span className="font-mono">records</span> (mapped to the target schema) and <span className="font-mono">count</span> to downstream nodes — chain into a Save Records node to write them.
      </p>
    </div>
  )
}
