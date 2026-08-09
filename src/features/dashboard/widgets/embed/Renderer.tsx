import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkEmbeddable } from '@/lib/api'
import { useIntegrations } from '@/features/integrations/hooks'
import { integrationsApi } from '@/features/integrations/api'
import type { EmbeddedIntegration } from '@/features/integrations/types'
import type { WidgetRendererProps } from '../../widget-contract'
import type { EmbedWidgetConfig } from './schema'
import { useSsoHandshake } from './useSsoHandshake'

// Lifted from features/menus/runtime/CustomMenuRuntime.tsx's EmbedFrame
// (Phase 7 of docs/dashboard-system-plan.md) — same embed-check-before-render
// flow, same reasoning for why a client-side load-timeout heuristic doesn't
// work (a blocked iframe still fires the DOM `load` event normally in
// Chromium). Adds the SSO layer on top: when config.integrationId is set
// and that integration is configured for signed_launch, this both (a)
// appends a freshly-minted token to the launch URL as a URL fragment
// (mode A, "signed launch" — see docs/dashboard-system-plan.md section
// 8.2) and (b) answers the Embed SDK's postMessage handshake for
// subsequent/refreshed token requests (mode B) via useSsoHandshake.
type EmbedStatus = 'checking' | 'embeddable' | 'blocked'

export function EmbedRenderer({ config, mode }: WidgetRendererProps<EmbedWidgetConfig>) {
  const { data: integrations } = useIntegrations()
  const integration = config.integrationId ? integrations?.find((i) => i.id === config.integrationId) : undefined

  if (!config.url) {
    return <div className="flex h-full items-center justify-center p-3 text-xs text-slate-400">No webpage URL has been configured yet.</div>
  }

  return <EmbedFrame url={config.url} integration={integration} builderMode={mode === 'builder'} />
}

function EmbedFrame({ url, integration, builderMode }: { url: string; integration: EmbeddedIntegration | undefined; builderMode: boolean }) {
  const [status, setStatus] = useState<EmbedStatus>('checking')
  const [reason, setReason] = useState<string | undefined>()
  const [launchUrl, setLaunchUrl] = useState(url)
  // Only ever surfaced in the builder (see the banner below) — an SSO mint
  // failure at runtime silently falls back to a plain, non-SSO launch
  // rather than blocking the tile, which is the right behavior for an end
  // user (a broken embed is worse than an unauthenticated one), but the
  // person who configured SSO should be able to tell it isn't working.
  const [ssoFailed, setSsoFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useSsoHandshake(iframeRef, integration)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    setStatus('checking')

    checkEmbeddable(url)
      .then((result) => {
        if (cancelled) return
        setStatus(result.can_embed ? 'embeddable' : 'blocked')
        setReason(result.reason)
      })
      .catch(() => {
        if (cancelled) return
        setStatus('blocked')
        setReason('could not verify whether this page can be embedded')
      })

    return () => { cancelled = true }
  }, [url])

  // Signed-launch delivery mode A: mint a token up front and append it to
  // the iframe's src as a URL fragment — fragments never reach the server
  // (not sent in the Request-Line or Referer header), so this is the
  // lowest-exposure way to hand a token to a page load, vs. a query param.
  // Independent of useSsoHandshake's postMessage mode (B); an integration
  // can use either, or the partner page can ignore the fragment and just
  // call WorkflowEmbed.requestToken() instead.
  useEffect(() => {
    setSsoFailed(false)
    if (!integration || integration.auth_mode !== 'signed_launch') {
      setLaunchUrl(url)
      return
    }
    let cancelled = false
    integrationsApi.mintSSOToken(integration.id)
      .then((res) => {
        if (cancelled) return
        setLaunchUrl(`${url}#sso_token=${encodeURIComponent(res.token)}`)
      })
      .catch(() => {
        if (cancelled) return
        setLaunchUrl(url) // minting failed — fall back to a plain, non-SSO launch rather than blocking the tile entirely
        setSsoFailed(true)
      })
    return () => { cancelled = true }
  }, [url, integration])

  if (status === 'checking') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white text-center">
        <ExternalLink size={32} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-700">This page can't be displayed here</p>
        {reason && <p className="max-w-sm text-xs text-gray-400">{reason}</p>}
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button type="button" size="sm" className="gap-1.5">
            <ExternalLink size={13} /> Open in a new tab
          </Button>
        </a>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      {builderMode && ssoFailed && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
          <AlertTriangle size={12} className="shrink-0" />
          Couldn't sign in automatically — loaded without SSO. Check the integration's shared secret.
        </div>
      )}
      <iframe ref={iframeRef} key={launchUrl} src={launchUrl} title="Embedded page" className="h-full w-full flex-1 border-0" />
    </div>
  )
}
