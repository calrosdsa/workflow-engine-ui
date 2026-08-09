import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { RichTextWidgetConfig } from './schema'

export function RichTextConfigPanel({ config, onChange }: WidgetConfigPanelProps<RichTextWidgetConfig>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-slate-600">Markdown</Label>
      <Textarea
        value={config.markdown}
        onChange={(e) => onChange({ ...config, markdown: e.target.value })}
        rows={10}
        className="font-mono text-xs"
      />
      <p className="text-[10px] text-slate-400">Supports headings, bold/italic, links, lists, and blockquotes.</p>
    </div>
  )
}
