import { Code2, ShieldAlert } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { CustomHtmlWidgetConfig } from './schema'
import { HtmlCodeEditor } from './HtmlCodeEditor'
import { CustomHtmlRenderer } from './Renderer'

export function CustomHtmlConfigPanel({ config, onChange }: WidgetConfigPanelProps<CustomHtmlWidgetConfig>) {
  const t = useTranslation()
  const patch = (p: Partial<CustomHtmlWidgetConfig>) => onChange({ ...config, ...p })
  const embedCodeLabel = t('builder.dashboard_custom-html.mode_sandbox')

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_custom-html.mode')}</Label>
        <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
          <button
            type="button"
            onClick={() => patch({ mode: 'inline' })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
              config.mode === 'inline' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'
            }`}
          >
            <Code2 size={12} /> {t('builder.dashboard_custom-html.mode_inline')}
          </button>
          <button
            type="button"
            onClick={() => patch({ mode: 'sandbox' })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
              config.mode === 'sandbox' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'
            }`}
          >
            <ShieldAlert size={12} /> {embedCodeLabel}
          </button>
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {config.mode === 'inline'
            ? t('builder.dashboard_custom-html.hint_inline')
            : t('builder.dashboard_custom-html.hint_sandbox')}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {config.mode === 'inline' ? t('builder.dashboard_custom-html.html_label') : embedCodeLabel}
        </Label>
        <HtmlCodeEditor value={config.html} onChange={(html) => patch({ html })} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('common.preview')}</Label>
        <div className="h-40 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
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
