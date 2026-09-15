import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { RichTextWidgetConfig } from './schema'

export function RichTextConfigPanel({ config, onChange }: WidgetConfigPanelProps<RichTextWidgetConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_richtext.markdown_label')}</Label>
      <Textarea
        value={config.markdown}
        onChange={(e) => onChange({ ...config, markdown: e.target.value })}
        rows={10}
        className="font-mono text-xs"
      />
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_richtext.supports_hint')}</p>
    </div>
  )
}
