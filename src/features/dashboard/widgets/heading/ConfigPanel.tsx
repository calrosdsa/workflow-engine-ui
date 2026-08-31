import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { HeadingWidgetConfig } from './schema'

// Adapts features/page-builder/config/ComponentForms.tsx's HeadingComponentForm
// to the widget ConfigPanel shape (onChange replaces the whole config object
// here, rather than PageComponent's partial-patch convention).
export function HeadingConfigPanel({ config, onChange }: WidgetConfigPanelProps<HeadingWidgetConfig>) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Heading Text</Label>
        <Input value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Level</Label>
        <SelectMenu value={String(config.level)} onValueChange={(v) => onChange({ ...config, level: Number(v) as 1 | 2 | 3 })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1" className="text-xs">Heading 1 (large)</SelectItem>
            <SelectItem value="2" className="text-xs">Heading 2 (medium)</SelectItem>
            <SelectItem value="3" className="text-xs">Heading 3 (small)</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>
    </div>
  )
}
