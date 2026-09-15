import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { SpacerWidgetConfig } from './schema'

export function SpacerConfigPanel({ config, onChange }: WidgetConfigPanelProps<SpacerWidgetConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_spacer.height_label')}</Label>
      <Input type="number" value={config.height} onChange={(e) => onChange({ ...config, height: Number(e.target.value) })} className="h-8 text-sm" />
    </div>
  )
}
