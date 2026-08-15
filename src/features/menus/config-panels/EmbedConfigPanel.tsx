import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useIntegrations } from '@/features/integrations/hooks'

interface EmbedConfigPanelProps {
  value: string
  onChange: (url: string) => void
  integrationId?: string
  onIntegrationChange: (integrationId: string | undefined) => void
}

// Small: a single URL input + a live inline iframe preview beneath it so the
// builder can immediately see whether the target site actually allows
// embedding, before publishing — same "show the real thing, don't guess"
// instinct as ThemeSection.tsx's live preview pane. No load-timeout/blocked
// detection here (that's CustomMenuRuntime.tsx's job, Phase 6) — this is
// just a best-effort visual check during editing.
//
// The SSO picker mirrors the Dashboard embed widget's ConfigPanel.tsx
// exactly (same picker, same signed_launch-only filter) — Custom-menu embed
// is deliberately scoped to signed_launch only, no oidc/postMessage
// handshake, matching this surface's existing simpler scope (no "builder
// mode" concept to show a failure banner in, see CustomMenuRuntime.tsx's
// EmbedFrame doc comment).
export function EmbedConfigPanel({ value, onChange, integrationId, onIntegrationChange }: EmbedConfigPanelProps) {
  const { data: integrations } = useIntegrations()
  const ssoIntegrations = (integrations ?? []).filter((i) => i.auth_mode === 'signed_launch')

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Webpage URL</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-slate-400">
          Some sites block embedding and won't display here even with a valid URL — end users will see a
          fallback "open in a new tab" link for those.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Pass through identity (SSO)</Label>
        <SelectMenu
          value={integrationId ?? '__none__'}
          onValueChange={(v) => onIntegrationChange(v === '__none__' ? undefined : v)}
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
            : "The selected integration's shared secret must match what the embedded page verifies against. Also applies on the mobile app."}
        </p>
      </div>

      {value ? (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <iframe key={value} src={value} title="Embed preview" className="h-64 w-full" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400">
          Enter a URL to preview it here
        </div>
      )}
    </div>
  )
}
