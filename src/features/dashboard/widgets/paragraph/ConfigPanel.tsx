import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { ParagraphWidgetConfig } from './schema'

export function ParagraphConfigPanel({ config, onChange }: WidgetConfigPanelProps<ParagraphWidgetConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_paragraph.text_label')}</Label>
      <Textarea value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} rows={4} className="text-sm" />
    </div>
  )
}
