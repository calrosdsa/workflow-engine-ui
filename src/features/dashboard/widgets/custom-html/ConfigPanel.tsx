import { Code2, ShieldAlert } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { CustomHtmlWidgetConfig } from './schema'
import { HtmlCodeEditor } from './HtmlCodeEditor'
import { CustomHtmlRenderer } from './Renderer'

export function CustomHtmlConfigPanel({ config, onChange }: WidgetConfigPanelProps<CustomHtmlWidgetConfig>) {
  const patch = (p: Partial<CustomHtmlWidgetConfig>) => onChange({ ...config, ...p })

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Mode</Label>
        <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => patch({ mode: 'inline' })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
              config.mode === 'inline' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
            }`}
          >
            <Code2 size={12} /> Formatted content
          </button>
          <button
            type="button"
            onClick={() => patch({ mode: 'sandbox' })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
              config.mode === 'sandbox' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
            }`}
          >
            <ShieldAlert size={12} /> Embed code
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          {config.mode === 'inline'
            ? 'Sanitized and styled to match the app. Scripts and embeds are stripped.'
            : 'Runs in an isolated sandbox with no access to this app’s data or session — for third-party embed codes (YouTube, analytics, etc.) that need JavaScript.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">
          {config.mode === 'inline' ? 'HTML' : 'Embed code'}
        </Label>
        <HtmlCodeEditor value={config.html} onChange={(html) => patch({ html })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Preview</Label>
        <div className="h-40 overflow-hidden rounded-md border border-slate-200 bg-white">
          <CustomHtmlRenderer
            config={config}
            instance={{ id: 'preview', type: 'custom-html', layout: { x: 0, y: 0, w: 1, h: 1 }, chrome: 'plain', config }}
            clientId=""
            appId=""
            mode="builder"
          />
        </div>
      </div>
    </div>
  )
}
