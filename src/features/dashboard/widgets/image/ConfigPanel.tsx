import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { ImageWidgetConfig } from './schema'

export function ImageConfigPanel({ config, onChange }: WidgetConfigPanelProps<ImageWidgetConfig>) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Image URL</Label>
        <Input value={config.src} onChange={(e) => onChange({ ...config, src: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
        <p className="text-[10px] text-slate-400">No file upload yet — paste a direct link to an image.</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Alt Text</Label>
        <Input value={config.alt} onChange={(e) => onChange({ ...config, alt: e.target.value })} className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Width</Label>
        <SelectMenu value={config.width} onValueChange={(v) => onChange({ ...config, width: v as ImageWidgetConfig['width'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full" className="text-xs">Full width</SelectItem>
            <SelectItem value="half" className="text-xs">Half width</SelectItem>
            <SelectItem value="third" className="text-xs">A third</SelectItem>
            <SelectItem value="auto" className="text-xs">Auto (natural size)</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>
    </div>
  )
}
