import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { SpacerWidgetConfig } from './schema'

export function SpacerConfigPanel({ config, onChange }: WidgetConfigPanelProps<SpacerWidgetConfig>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Height (px)</Label>
      <Input type="number" value={config.height} onChange={(e) => onChange({ ...config, height: Number(e.target.value) })} className="h-8 text-sm" />
    </div>
  )
}
