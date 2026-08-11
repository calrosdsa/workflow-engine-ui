import { useEffect, useRef } from 'react'
import { integrationsApi } from '@/features/integrations/api'
import type { EmbeddedIntegration } from '@/features/integrations/types'

// OIDC silent-auth mode (FR-D3-008) — a sibling to useSsoHandshake's
// signed_launch flow, but structurally different: signed_launch mints a
// token in one request/response round trip; OIDC is a real OAuth2
// Authorization Code + PKCE exchange against an external IdP, which needs a
// full browser-context navigation (the IdP's /authorize page, even under
// prompt=none, is a real page load, not an API call) — so this hook drives
// a genuinely hidden <iframe>, invisible to the end user, that navigates
// through the IdP and back to this platform's own /integrations/oidc/callback
// page, which then postMessages the result up via window.parent.
//
// Result delivery: once a token is obtained, it's handed back to the CALLER
// (not delivered directly to the embed iframe here) via onResult, so the
// caller (Renderer.tsx's EmbedFrame) can apply it through the exact same
// URL-fragment delivery path signed_launch already uses (#sso_token=) —
// one delivery mechanism for both auth modes, not two.
//
// Silent-auth failure (no active IdP session, consent required, IdP
// unreachable, discovery-document fetch failed) reports ok: false via
// onResult exactly like a timeout does — the caller's own fallback (plain,
// non-SSO launch, matching signed_launch's existing mint-failure UX) never
// needs to distinguish the two.
const SILENT_AUTH_TIMEOUT_MS = 8000

export interface OidcHandshakeResult {
  ok: boolean
  token?: string
}

export function useOidcHandshake(
  integration: EmbeddedIntegration | undefined,
  onResult: (result: OidcHandshakeResult) => void,
) {
  const hiddenFrameRef = useRef<HTMLIFrameElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settledRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!integration || integration.auth_mode !== 'oidc') return

    settledRef.current = false
    const integrationId = integration.id

    function settle(result: OidcHandshakeResult) {
      if (settledRef.current) return
      settledRef.current = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      onResultRef.current(result)
    }

    function handleMessage(event: MessageEvent) {
      // The callback page is same-origin (it's this platform's own
      // /integrations/oidc/callback route) — a stricter origin check than
      // useSsoHandshake's allowed_origins check isn't needed here since this
      // listener only ever expects a message from an iframe THIS hook
      // itself created and navigated, not an arbitrary partner page.
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (!data || typeof data !== 'object' || data.type !== 'wf:sso:oidc_result') return
      if (data.integrationId !== integrationId) return
      settle(data.ok ? { ok: true, token: data.token } : { ok: false })
    }

    window.addEventListener('message', handleMessage)

    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    frame.setAttribute('aria-hidden', 'true')
    document.body.appendChild(frame)
    hiddenFrameRef.current = frame

    integrationsApi.startOidcFlow(integrationId)
      .then((res) => {
        if (settledRef.current) return
        frame.src = res.authorize_url
      })
      .catch(() => {
        // Couldn't even start the flow (discovery-document fetch failed,
        // integration misconfigured, etc.) — same observable outcome as any
        // other silent-auth failure.
        settle({ ok: false })
      })

    timeoutRef.current = setTimeout(() => {
      settle({ ok: false })
    }, SILENT_AUTH_TIMEOUT_MS)

    return () => {
      window.removeEventListener('message', handleMessage)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      frame.remove()
      hiddenFrameRef.current = null
    }
  }, [integration])
}
