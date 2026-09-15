// run_agent — mirrors internal/graph/configs.go's RunAgentConfig
// (FR-B2-029). input_mappings is deliberately NOT exposed here — see
// FR-C5-013 v0.2's Revision History for why Subflow's own mapping editor
// isn't reusable for an Agent target.
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { AgentSelect } from '../config/AgentSelect'
import { cn } from '@/lib/utils'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, RunAgentConfig, TaskMode } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

export function normaliseRunAgentConfig(raw: unknown): RunAgentConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<RunAgentConfig>
  return {
    agent_id:  r.agent_id ?? '',
    task_mode: r.task_mode ?? 'literal',
    task:      r.task ?? '',
    task_expr: r.task_expr ?? '',
    output_var: r.output_var ?? '',
  }
}

function TaskModeToggle({ mode, onChange }: { mode: TaskMode; onChange: (m: TaskMode) => void }) {
  const { t } = useI18n()
  return (
    <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
      {(['literal', 'expression'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {m === 'literal' ? t('workflows.node_forms.static') : t('workflows.node_forms.expression')}
        </button>
      ))}
    </div>
  )
}

export interface RunAgentFormProps {
  config: RunAgentConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: RunAgentConfig) => void
}

export function RunAgentForm({ config, variables, nodeContext, onChange }: RunAgentFormProps) {
  const { t } = useI18n()
  const set = (patch: Partial<RunAgentConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.agent')}</Label>
        <AgentSelect value={config.agent_id || undefined} onChange={(id) => set({ agent_id: id ?? '' })} />
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.task')}</Label>
        <TaskModeToggle mode={config.task_mode ?? 'literal'} onChange={(m) => set({ task_mode: m })} />
        {config.task_mode === 'expression' ? (
          <ExpressionField
            value={config.task_expr ?? ''}
            onChange={(v) => set({ task_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder="e.g. NodeOutputs.fetch1.records[0].body"
            label={t('workflows.node_forms.task')}
          />
        ) : (
          <textarea
            value={config.task ?? ''}
            onChange={(e) => set({ task: e.target.value })}
            rows={4}
            placeholder="e.g. Draft a reply to this support ticket…"
            className="w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
          />
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.agent_task_help')}</p>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.output_variable')}</Label>
        <Input
          value={config.output_var}
          onChange={(e) => set({ output_var: e.target.value })}
          placeholder="agent_result"
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.agent_output_help')}</p>
      </div>
    </div>
  )
}
