import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useIntegrations } from '@/features/integrations/hooks'
import type { WidgetConfigPanelProps } from '../../widget-contract'
import type { EmbedWidgetConfig } from './schema'

export function EmbedConfigPanel({ config, onChange }: WidgetConfigPanelProps<EmbedWidgetConfig>) {
  const { data: integrations } = useIntegrations()
  const ssoIntegrations = (integrations ?? []).filter((i) => i.auth_mode === 'signed_launch')

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Webpage URL</Label>
        <Input
          value={config.url}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://…"
          className="h-8 font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Pass through identity (SSO)</Label>
        <SelectMenu
          value={config.integrationId ?? '__none__'}
          onValueChange={(v) => onChange({ ...config, integrationId: v === '__none__' ? undefined : v })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No SSO — plain embed" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs">No SSO — plain embed</SelectItem>
            {ssoIntegrations.map((i) => (
              <SelectItem key={i.id} value={i.id} className="text-xs">{i.name}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
        <p className="text-[10px] text-slate-400">
          {ssoIntegrations.length === 0
            ? 'No integrations are configured for signed launch yet — add one in App Settings.'
            : "The selected integration's shared secret must match what the embedded page verifies against."}
        </p>
      </div>
    </div>
  )
}
