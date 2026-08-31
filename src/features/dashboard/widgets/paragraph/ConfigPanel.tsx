import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { ParagraphWidgetConfig } from './schema'

export function ParagraphConfigPanel({ config, onChange }: WidgetConfigPanelProps<ParagraphWidgetConfig>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Paragraph Text</Label>
      <Textarea value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} rows={4} className="text-sm" />
    </div>
  )
}
