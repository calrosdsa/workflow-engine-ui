import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useIntegrations } from '@/features/integrations/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { EmbedWidgetConfig } from './schema'

export function EmbedConfigPanel({ config, onChange }: WidgetConfigPanelProps<EmbedWidgetConfig>) {
  const t = useTranslation()
  const { data: integrations } = useIntegrations()
  const ssoIntegrations = (integrations ?? []).filter((i) => i.auth_mode === 'signed_launch')
  const noSsoLabel = t('builder.dashboard_embed.no_sso')

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_embed.webpage_url')}</Label>
        <Input
          value={config.url}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://…"
          className="h-8 font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_embed.sso_label')}</Label>
        <SelectMenu
          value={config.integrationId ?? '__none__'}
          onValueChange={(v) => onChange({ ...config, integrationId: v === '__none__' ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={noSsoLabel} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs">{noSsoLabel}</SelectItem>
            {ssoIntegrations.map((i) => (
              <SelectItem key={i.id} value={i.id} className="text-xs">{i.name}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {ssoIntegrations.length === 0
            ? t('builder.dashboard_embed.no_sso_hint')
            : t('builder.dashboard_embed.sso_secret_hint')}
        </p>
      </div>
    </div>
  )
}
