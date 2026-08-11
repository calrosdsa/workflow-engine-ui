import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DebugConfig } from '../../types'

// debug — no normalisation needed; the config shape is a single optional
// string field, safe to cast directly.
export function normaliseDebugConfig(raw: unknown): DebugConfig {
  return (raw ?? {}) as DebugConfig
}

export interface DebugFormProps {
  config: DebugConfig
  onChange: (c: DebugConfig) => void
}

export function DebugForm({ config, onChange }: DebugFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Label (optional)</Label>
        <Input
          value={config.label ?? ''}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g. after fetching records"
          className="h-8 text-[12px]"
        />
        <p className="text-[10px] text-slate-400">
          Shown alongside this node's captured snapshot when viewing a past execution — useful for telling multiple debug nodes apart.
        </p>
      </div>
      <p className="text-[11px] text-slate-400">
        Captures a snapshot of every workflow variable at this point in the graph. Has no effect on control flow or variable state — view the captured values on the node itself once an execution has run.
      </p>
    </div>
  )
}
