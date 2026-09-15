import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { ImageWidgetConfig } from './schema'

export function ImageConfigPanel({ config, onChange }: WidgetConfigPanelProps<ImageWidgetConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_image.url_label')}</Label>
        <Input value={config.src} onChange={(e) => onChange({ ...config, src: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_image.no_upload_hint')}</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_image.alt_text')}</Label>
        <Input value={config.alt} onChange={(e) => onChange({ ...config, alt: e.target.value })} className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_image.width')}</Label>
        <SelectMenu value={config.width} onValueChange={(v) => onChange({ ...config, width: v as ImageWidgetConfig['width'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full" className="text-xs">{t('builder.dashboard_image.width_full')}</SelectItem>
            <SelectItem value="half" className="text-xs">{t('builder.dashboard_image.width_half')}</SelectItem>
            <SelectItem value="third" className="text-xs">{t('builder.dashboard_image.width_third')}</SelectItem>
            <SelectItem value="auto" className="text-xs">{t('builder.dashboard_image.width_auto')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>
    </div>
  )
}
