import { Label } from '@/components/ui/label'
import { Filter as FilterIcon } from 'lucide-react'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ensureGroupIds } from './id-helpers'
import { MatchModeToggle } from './UpdateRecordsForm'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, DeleteRecordsConfig } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

export function normaliseDeleteRecordsConfig(raw: unknown): DeleteRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DeleteRecordsConfig>
  return {
    form_id:   r.form_id ?? '',
    mode:      r.mode ?? 'one',
    filter:    ensureGroupIds(r.filter) ?? newGroup(),
    count_var: r.count_var ?? '',
  }
}

export interface DeleteRecordsFormProps {
  config: DeleteRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: DeleteRecordsConfig) => void
}

export function DeleteRecordsForm({ config, variables, nodeContext, onChange }: DeleteRecordsFormProps) {
  const { t } = useI18n()
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<DeleteRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.form_table')}</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.match')}</Label>
        <MatchModeToggle mode={config.mode} onChange={(mode) => set({ mode })} accent="bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]" />
        {config.mode === 'one' ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.multiple_match_warning')}</p>
        ) : (
          <p className="text-[10px] text-[hsl(var(--warning))]">{t('workflows.node_forms.delete_warning')}</p>
        )}
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-[hsl(var(--muted-foreground))]" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.filter')}</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.select_form_filters')}</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
        <p className="rounded-lg border border-dashed border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-2 text-[10px] text-[hsl(var(--destructive))]">
          {t('workflows.node_forms.delete_required')}
        </p>
      </div>

      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t('workflows.node_forms.outputs_delete')}
      </p>
    </div>
  )
}
