import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, IteratorConfig } from '../../types'

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
  const set = (patch: Partial<IteratorConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Source list */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source List</Label>
        <ExpressionField
          value={config.source_expr ?? ''}
          onChange={(v) => set({ source_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. NodeOutputs["fetch"]["records"]'
          label="source list"
        />
        <p className="text-[10px] text-slate-400">Must resolve to a list. The body runs once per element.</p>
      </div>

      {/* Item / index var names */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Item Var</Label>
          <Input
            value={config.item_var ?? 'item'}
            onChange={(e) => set({ item_var: e.target.value })}
            placeholder="item"
            className="h-8 font-mono text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Index Var</Label>
          <Input
            value={config.index_var ?? 'index'}
            onChange={(e) => set({ index_var: e.target.value })}
            placeholder="index"
            className="h-8 font-mono text-[12px]"
          />
        </div>
      </div>
      <p className="-mt-2 text-[10px] text-slate-400">
        Inside the loop body, reference <code className="text-amber-600">Vars["{config.item_var || 'item'}"]</code> and <code className="text-amber-600">Vars["{config.index_var || 'index'}"]</code>.
      </p>

      <div className="h-px bg-slate-100" />

      {/* Filter condition */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filter (optional)</Label>
        <ExpressionField
          value={config.filter_expr ?? ''}
          onChange={(v) => set({ filter_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. Vars["item"]["active"] == true'
          label="filter condition"
        />
        <p className="text-[10px] text-slate-400">Run the body only when this is true (skip the element otherwise).</p>
      </div>

      {/* Stop condition */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Stop When (optional)</Label>
        <ExpressionField
          value={config.stop_expr ?? ''}
          onChange={(v) => set({ stop_expr: v })}
          variables={variables}
          nodeContext={nodeContext}
          placeholder='e.g. Vars["index"] >= 10'
          label="stop condition"
        />
        <p className="text-[10px] text-slate-400">Stop the loop early when this becomes true.</p>
      </div>

      {/* Max iterations */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Max Iterations</Label>
        <Input
          type="number"
          min={0}
          value={config.max_iters || ''}
          onChange={(e) => set({ max_iters: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
          placeholder="0 = unlimited"
          className="h-8 w-32 text-[12px]"
        />
      </div>

      <div className="h-px bg-slate-100" />

      {/* Continue on error */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Continue on Error</Label>
          <p className="text-[10px] text-slate-400">
            If an item's body fails, skip it and keep going instead of stopping the loop. Failed items are listed on the iterator node.
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
