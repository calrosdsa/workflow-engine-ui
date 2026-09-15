import { Label } from '@/components/ui/label'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, SaveRecordsConfig } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

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
  const { t } = useI18n()
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const uniqueFields = fields.filter((f) => f.unique)

  const set = (patch: Partial<SaveRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Target form */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.form_table')}</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Unique-field match info */}
      {config.form_id && (
        uniqueFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2.5 text-[11px] text-[hsl(var(--warning))]">
            {t('workflows.node_forms.no_unique_save')}
          </p>
        ) : (
          <p className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('workflows.node_forms.matches_on', { fields: uniqueFields.map((f) => f.label || f.name).join(', ') })}
          </p>
        )
      )}

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.records_to_save')}</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["transform1"]["records"]'
          label={t('workflows.node_forms.records_to_save')}
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.outputs_save_records')}
        </p>
      </div>

      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t('workflows.node_forms.outputs_save_records')}
      </p>
    </div>
  )
}
