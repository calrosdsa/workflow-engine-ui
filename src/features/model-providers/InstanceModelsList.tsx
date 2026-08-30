import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useInstanceModels, useSetModelEnabled } from './hooks'
import { CapabilityBadge } from './CapabilityBadge'

interface InstanceModelsListProps {
  instanceId: string
  canWrite: boolean
}

export function InstanceModelsList({ instanceId, canWrite }: InstanceModelsListProps) {
  const { data: models, isLoading } = useInstanceModels(instanceId)
  const setEnabledMutation = useSetModelEnabled(instanceId)

  if (isLoading) {
    return <div className="flex h-16 items-center justify-center"><Spinner className="h-4 w-4" /></div>
  }

  return (
    <div className="space-y-1 border-t border-[hsl(var(--border))] px-3 py-2">
      {(models ?? []).map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[hsl(var(--muted))]/40">
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[hsl(var(--foreground))]">{m.model}</span>
          <CapabilityBadge capability={m.capability} />
          <Switch
            checked={m.enabled}
            disabled={!canWrite || setEnabledMutation.isPending}
            onCheckedChange={(checked) => setEnabledMutation.mutate({ modelId: m.id, enabled: checked })}
          />
        </div>
      ))}
    </div>
  )
}
