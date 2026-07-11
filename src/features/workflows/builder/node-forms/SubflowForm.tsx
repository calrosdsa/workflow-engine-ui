import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface SubflowConfig {
  definition_id: string
}

// subflow — no normalisation needed; the config shape has been stable
// since the DAG redesign and is safe to cast directly.
export function normaliseSubflowConfig(raw: unknown): SubflowConfig {
  return raw as SubflowConfig
}

export interface SubflowFormProps {
  config: SubflowConfig
  onChange: (c: SubflowConfig) => void
}

export function SubflowForm({ config, onChange }: SubflowFormProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workflow Definition ID</Label>
      <Input
        value={config.definition_id ?? ''}
        onChange={(e) => onChange({ definition_id: e.target.value })}
        placeholder="Paste workflow UUID…"
        className="text-xs font-mono"
      />
    </div>
  )
}
