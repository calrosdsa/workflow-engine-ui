import { Label } from '@/components/ui/label'
import { Filter as FilterIcon } from 'lucide-react'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ensureGroupIds } from './id-helpers'
import { MatchModeToggle } from './UpdateRecordsForm'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, DeleteRecordsConfig } from '../../types'

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
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<DeleteRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Match</Label>
        <MatchModeToggle mode={config.mode} onChange={(mode) => set({ mode })} accent="bg-red-500" />
        {config.mode === 'one' ? (
          <p className="text-[10px] text-slate-400">Fails if the filter matches more than one record.</p>
        ) : (
          <p className="text-[10px] text-amber-600">Every record matching the filter below will be deleted — double-check it isn't broader than intended.</p>
        )}
      </div>

      <div className="h-px bg-slate-100" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-slate-400" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">Select a form to add filters.</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
        <p className="rounded-lg border border-dashed border-red-200 bg-red-50 p-2 text-[10px] text-red-600">
          A filter is required — deleting an entire table by accident is not allowed.
        </p>
      </div>

      <p className="text-[10px] text-slate-400">
        Outputs <span className="font-mono">count</span> to downstream nodes.
      </p>
    </div>
  )
}
