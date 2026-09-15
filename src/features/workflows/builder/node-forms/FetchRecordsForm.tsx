import { Plus, Trash2, ArrowUpDown, Filter as FilterIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FilterBuilder, newGroup } from '../FilterBuilder'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useForm } from '@/features/forms/hooks'
import { nanoid } from '../nanoid'
import { ensureGroupIds } from './id-helpers'
import { useI18n } from '@/features/i18n/I18nProvider'
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
  const { t } = useI18n()
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
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.form_table')}</Label>
        <FormReferenceSelect value={config.form_id || undefined} onChange={(id) => set({ form_id: id ?? '' })} />
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.retrieve')}</Label>
        <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
          {(['many', 'one'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set({ mode: m as FetchMode })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.mode === m ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {m === 'many' ? t('workflows.node_forms.multiple_records') : t('workflows.node_forms.single_record')}
            </button>
          ))}
        </div>
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
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={12} className="text-[hsl(var(--muted-foreground))]" />
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.sort')}</Label>
          </div>
          <button onClick={addSort} disabled={!config.form_id} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 disabled:opacity-40">
            <Plus size={11} /> {t('workflows.node_forms.add')}
          </button>
        </div>
        {config.sort.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <select
              value={s.field}
              onChange={(e) => updateSort(s.id, { field: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-1 text-[11px] text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
            >
              <option value="">{t('workflows.builder.field_placeholder')}</option>
              {fields.map((f) => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
            </select>
            <select
              value={s.dir}
              onChange={(e) => updateSort(s.id, { dir: e.target.value as 'asc' | 'desc' })}
              className="shrink-0 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-1.5 py-1 text-[11px] text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:outline-none"
            >
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
            <button onClick={() => removeSort(s.id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Limit */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.limit')}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            value={config.mode === 'one' ? 1 : config.limit || ''}
            disabled={config.mode === 'one'}
            onChange={(e) => set({ limit: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder={t('workflows.node_forms.zero_all')}
            className="h-7 w-24 text-[12px]"
          />
          <div className="flex gap-1">
            {[10, 100].map((n) => (
              <button key={n} onClick={() => set({ limit: n })} disabled={config.mode === 'one'} className="rounded border border-[hsl(var(--border))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-40">
                {t('workflows.node_forms.top_n', { count: n })}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.outputs_fetch')}
        </p>
      </div>
    </div>
  )
}
