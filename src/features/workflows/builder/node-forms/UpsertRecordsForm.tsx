import { Label } from '@/components/ui/label'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ValuesEditor } from '../ValuesEditor'
import { ensureValueIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, UpsertRecordsConfig } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

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
  const { t } = useI18n()
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []
  const uniqueFields = fields.filter((f) => f.unique)

  const set = (patch: Partial<UpsertRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.form_table')}</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Unique-field match info */}
      {config.form_id && (
        uniqueFields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-2.5 text-[11px] text-[hsl(var(--warning))]">
            {t('workflows.node_forms.no_unique_upsert')}
          </p>
        ) : (
          <p className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-2.5 text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('workflows.node_forms.matches_on', { fields: uniqueFields.map((f) => f.label || f.name).join(', ') })}
          </p>
        )
      )}

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Values */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.field_values')}</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.select_form_values')}</p>
        ) : (
          <ValuesEditor
            values={config.values}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(values) => set({ values })}
          />
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.outputs_upsert')}
        </p>
      </div>
    </div>
  )
}
