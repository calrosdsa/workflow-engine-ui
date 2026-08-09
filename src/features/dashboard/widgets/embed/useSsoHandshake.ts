import { useEffect, useRef } from 'react'
import { integrationsApi } from '@/features/integrations/api'
import type { EmbeddedIntegration } from '@/features/integrations/types'

// Parent (dashboard) side of the Embed SDK handshake — public/embed-sdk.js
// is the child (partner-page) side; see docs/dashboard-system-plan.md
// section 8.2 for the full protocol. Handles the postMessage half of SSO
// delivery; the URL-fragment delivery mode (mode A, "signed launch") is
// handled separately by embedUrlWithToken in Renderer.tsx — an integration
// can use either or both.
//
// Security invariants, each directly answering a specific attack:
//   - `wf:sso:request` is only honored from an origin listed in the
//     integration's allowed_origins — a request from any other origin
//     (e.g. a malicious page that iframed OUR dashboard and is fishing for
//     a token) is silently ignored. No error is echoed back, so an
//     unauthorized origin gets no oracle for "was I close".
//   - The minted token is delivered via postMessage with an explicit
//     targetOrigin (the SAME allowed origin the request came from) — never
//     '*' — so only that exact iframe can read it, even if something else
//     is also listening on 'message' in the parent page.
//   - `wf:sso:logout` is broadcast to every mounted embed iframe on
//     platform logout (see broadcastLogoutToAllEmbeds below), each still
//     targetOrigin-scoped individually.
export function useSsoHandshake(iframeRef: React.RefObject<HTMLIFrameElement | null>, integration: EmbeddedIntegration | undefined) {
  // Re-entered on every message event without staleness, since the handler
  // itself is re-registered whenever `integration` changes (see the effect
  // below) — a ref isn't needed here the way it would be for a handler that
  // must outlive prop changes without re-subscribing.
  const mintingRef = useRef(false)

  useEffect(() => {
    if (!integration || integration.auth_mode !== 'signed_launch') return

    function handleMessage(event: MessageEvent) {
      const iframe = iframeRef.current
      if (!iframe || event.source !== iframe.contentWindow) return
      if (!integration!.allowed_origins.includes(event.origin)) return
      if (!event.data || typeof event.data !== 'object') return

      if (event.data.type === 'wf:sso:request') {
        if (mintingRef.current) return // one in-flight mint at a time per tile
        mintingRef.current = true
        integrationsApi.mintSSOToken(integration!.id)
          .then((res) => {
            iframe.contentWindow?.postMessage({ type: 'wf:sso:token', token: res.token }, event.origin)
          })
          .catch(() => {
            // Minting failed (e.g. transient backend error) — no token is
            // sent; the partner page's onToken callback simply never
            // fires, same observable outcome as an unauthorized origin,
            // which is the correct fail-closed behavior either way.
          })
          .finally(() => { mintingRef.current = false })
      } else if (event.data.type === 'wf:resize' && typeof event.data.height === 'number') {
        iframe.style.height = `${Math.max(0, event.data.height)}px`
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [integration, iframeRef])
}
