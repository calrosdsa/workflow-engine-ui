import { Plus, Trash2, ArrowUpDown, Filter as FilterIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { nanoid } from '../nanoid'
import { ensureGroupIds } from './id-helpers'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, FetchRecordsConfig, SortRule, FetchMode } from '../../types'

export function normaliseFetchRecordsConfig(raw: unknown): FetchRecordsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FetchRecordsConfig>
  return {
    form_id:     r.form_id ?? '',
    mode:        r.mode ?? 'many',
    filter:      ensureGroupIds(r.filter) ?? newGroup(),
    refine_expr: r.refine_expr ?? '',
    sort:        (r.sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() })),
    limit:       r.limit ?? 0,
    output_var:  r.output_var ?? '',
    count_var:   r.count_var ?? '',
  }
}

export interface FetchRecordsFormProps {
  config: FetchRecordsConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: FetchRecordsConfig) => void
}

export function FetchRecordsForm({ config, variables, nodeContext, onChange }: FetchRecordsFormProps) {
  const { data: form } = useForm(config.form_id || '')
  const fields = form?.fields ?? []

  const set = (patch: Partial<FetchRecordsConfig>) => onChange({ ...config, ...patch })

  const addSort = () =>
    set({ sort: [...config.sort, { id: nanoid(), field: '', dir: 'asc' }] })
  const updateSort = (id: string, patch: Partial<SortRule>) =>
    set({ sort: config.sort.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const removeSort = (id: string) =>
    set({ sort: config.sort.filter((s) => s.id !== id) })

  return (
    <div className="space-y-4">
      {/* Form picker */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form / Table</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Retrieve</Label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(['many', 'one'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mode: m as FetchMode })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.mode === m ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'many' ? 'Multiple records' : 'Single record'}
            </button>
          ))}
        </div>
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
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-slate-400" />
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sort</Label>
          </div>
          <button onClick={addSort} disabled={!config.form_id} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-40">
            <Plus size={11} /> Add
          </button>
        </div>
        {config.sort.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <select
              value={s.field}
              onChange={(e) => updateSort(s.id, { field: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
            >
              <option value="">field…</option>
              {fields.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
            </select>
            <select
              value={s.dir}
              onChange={(e) => updateSort(s.id, { dir: e.target.value as 'asc' | 'desc' })}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-rose-400 focus:outline-none"
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
            <button onClick={() => removeSort(s.id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Limit */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Limit</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            value={config.mode === 'one' ? 1 : config.limit || ''}
            disabled={config.mode === 'one'}
            onChange={(e) => set({ limit: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder="0 = all"
            className="h-7 w-24 text-[12px]"
          />
          <div className="flex gap-1">
            {[10, 100].map((n) => (
              <button key={n} onClick={() => set({ limit: n })} disabled={config.mode === 'one'} className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                Top {n}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Outputs <span className="font-mono">records</span>, <span className="font-mono">count</span>, and <span className="font-mono">first</span> to downstream nodes.
        </p>
      </div>
    </div>
  )
}
