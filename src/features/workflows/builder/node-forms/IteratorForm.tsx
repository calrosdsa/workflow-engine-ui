import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, IteratorConfig } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

// iterator — no normalisation needed; the config shape has been stable
// since the loop-body feature shipped and is safe to cast directly.
export function normaliseIteratorConfig(raw: unknown): IteratorConfig {
  return raw as IteratorConfig
}

export interface IteratorFormProps {
  config: IteratorConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: IteratorConfig) => void
}

export function IteratorForm({ config, variables, nodeContext, onChange }: IteratorFormProps) {
  const { t } = useI18n()
  const set = (patch: Partial<IteratorConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.source_list')}</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["fetch"]["records"]'
          label={t('workflows.node_forms.source_list')}
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.source_iterator_help')}</p>
      </div>

      {/* Item / index var names */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.item_var')}</Label>
          <Input
            value={config.item_var ?? 'item'}
            onChange={(e) => set({ item_var: e.target.value })}
            placeholder="item"
            className="h-8 font-mono text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.index_var')}</Label>
          <Input
            value={config.index_var ?? 'index'}
            onChange={(e) => set({ index_var: e.target.value })}
            placeholder="index"
            className="h-8 font-mono text-[12px]"
          />
        </div>
      </div>
      <p className="-mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
        Inside the loop body, reference <code className="text-[hsl(var(--warning))]">Vars["{config.item_var || 'item'}"]</code> and <code className="text-[hsl(var(--warning))]">Vars["{config.index_var || 'index'}"]</code>.
      </p>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Filter condition */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.filter_optional')}</Label>
        <ExpressionField
          value={config.filter_expr ?? ''}
          onChange={(v) => set({ filter_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. Vars["item"]["active"] == true'
          label={t('workflows.node_forms.filter_condition')}
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.run_when_true')}</p>
      </div>

      {/* Stop condition */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.stop_when')}</Label>
        <ExpressionField
          value={config.stop_expr ?? ''}
          onChange={(v) => set({ stop_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. Vars["index"] >= 10'
          label={t('workflows.node_forms.stop_condition')}
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.stop_early')}</p>
      </div>

      {/* Max iterations */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.max_iterations')}</Label>
        <Input
          type="number"
          min={0}
          value={config.max_iters || ''}
          onChange={(e) => set({ max_iters: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
          placeholder="0 = unlimited"
          className="h-8 w-32 text-[12px]"
        />
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Continue on error */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.continue_on_error')}</Label>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t('workflows.node_forms.continue_error_help')}
          </p>
        </div>
        <Switch
          checked={config.continue_on_error ?? false}
          onCheckedChange={(checked) => set({ continue_on_error: checked })}
          className="mt-0.5 shrink-0"
        />
      </div>
    </div>
  )
}
