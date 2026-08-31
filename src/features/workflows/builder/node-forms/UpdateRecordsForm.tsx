import { Label } from '@/components/ui/label'
import { Filter as FilterIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { ValuesEditor } from '../ValuesEditor'
import { ensureGroupIds, ensureValueIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, UpdateRecordsConfig, RecordMatchMode } from '../../types'

export function normaliseUpdateRecordsConfig(raw: unknown): UpdateRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<UpdateRecordsConfig>
  return {
    form_id:    r.form_id ?? '',
    mode:       r.mode ?? 'one',
    filter:     ensureGroupIds(r.filter) ?? newGroup(),
    values:     ensureValueIds(r.values),
    output_var: r.output_var ?? '',
    count_var:  r.count_var ?? '',
  }
}

// Shared by update_records and delete_records.
export function MatchModeToggle({ mode, onChange, accent = 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' }: { mode: RecordMatchMode; onChange: (m: RecordMatchMode) => void; accent?: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
      {(['one', 'many'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? `${accent} shadow-sm` : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {m === 'one' ? 'Single record' : 'Multiple records'}
        </button>
      ))}
    </div>
  )
}

export interface UpdateRecordsFormProps {
  config: UpdateRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: UpdateRecordsConfig) => void
}

export function UpdateRecordsForm({ config, variables, nodeContext, onChange }: UpdateRecordsFormProps) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<UpdateRecordsConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Match</Label>
        <MatchModeToggle mode={config.mode} onChange={(mode) => set({ mode })} />
        {config.mode === 'one' ? (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Fails if the filter matches more than one record.</p>
        ) : (
          <p className="text-[10px] text-[hsl(var(--warning))]">Every record matching the filter below will be updated — double-check it isn't broader than intended.</p>
        )}
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FilterIcon size={12} className="text-[hsl(var(--muted-foreground))]" />
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Filter</Label>
        </div>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">Select a form to add filters.</p>
        ) : (
          <FilterBuilder
            group={config.filter ?? newGroup()}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(g) => set({ filter: g })}
          />
        )}
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Values */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Field values</Label>
        {!config.form_id ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">Select a form to set field values.</p>
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
          Outputs <span className="font-mono">records</span> and <span className="font-mono">count</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}
