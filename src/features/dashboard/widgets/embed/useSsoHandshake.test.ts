// @vitest-environment jsdom
//
// This is the parent-side security enforcement for the embed widget's SSO
// handshake (docs/dashboard-system-plan.md section 8.2) — the actual
// boundary deciding whether a postMessage from an iframe gets a signed
// token in response. Tested against real MessageEvents dispatched at a
// real jsdom iframe's contentWindow, not just a config-shape check, the
// same standard sanitize.test.ts holds DOMPurify to in Phase 6.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { useSsoHandshake } from './useSsoHandshake'
import type { EmbeddedIntegration } from '@/features/integrations/types'

vi.mock('@/features/integrations/api', () => ({
  integrationsApi: { mintSSOToken: vi.fn() },
}))
import { integrationsApi } from '@/features/integrations/api'

function fakeIntegration(overrides: Partial<EmbeddedIntegration> = {}): EmbeddedIntegration {
  return {
    id: 'integ-1',
    name: 'Test Integration',
    base_url: 'https://partner.example.com',
    allowed_origins: ['https://partner.example.com'],
    auth_mode: 'signed_launch',
    signing_alg: 'HS256',
    has_shared_secret: true,
    claims: { email: true, name: true, roles: false },
    token_ttl_secs: 300,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Builds a real jsdom <iframe> (so .contentWindow is a genuine Window we
 *  can dispatch MessageEvents "from") and a ref pointing at it, mirroring
 *  how the Renderer wires iframeRef in real usage. */
function makeIframeRef() {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  const ref = createRef<HTMLIFrameElement>()
  // In real usage React sets `.current` via the DOM ref callback; assigning
  // it directly here is fine — createRef's return type allows writes,
  // it's just not how a mounted component normally populates it.
  ;(ref as { current: HTMLIFrameElement | null }).current = iframe
  return { iframe, ref }
}

function dispatchMessage(source: Window | null, origin: string, data: unknown) {
  const event = new MessageEvent('message', { data, origin, source: source as Window })
  window.dispatchEvent(event)
}

beforeEach(() => {
  vi.mocked(integrationsApi.mintSSOToken).mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useSsoHandshake', () => {
  it('mints and replies with a token for a wf:sso:request from an allowed origin', async () => {
    const { iframe, ref } = makeIframeRef()
    const integration = fakeIntegration()
    vi.mocked(integrationsApi.mintSSOToken).mockResolvedValue({ token: 'signed.jwt.here', expires_in: 300 })
    const postMessageSpy = vi.spyOn(iframe.contentWindow!, 'postMessage')

    renderHook(() => useSsoHandshake(ref, integration))

    dispatchMessage(iframe.contentWindow, 'https://partner.example.com', { type: 'wf:sso:request' })
    await vi.waitFor(() => expect(integrationsApi.mintSSOToken).toHaveBeenCalledWith('integ-1'))
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'wf:sso:token', token: 'signed.jwt.here' },
      'https://partner.example.com',
    ))
  })

  it('silently ignores a wf:sso:request from an origin NOT in allowed_origins', async () => {
    const { iframe, ref } = makeIframeRef()
    const integration = fakeIntegration({ allowed_origins: ['https://partner.example.com'] })

    renderHook(() => useSsoHandshake(ref, integration))

    dispatchMessage(iframe.contentWindow, 'https://evil.example.com', { type: 'wf:sso:request' })
    // Give any (incorrect) async mint a tick to have fired, then assert it didn't.
    await new Promise((r) => setTimeout(r, 20))
    expect(integrationsApi.mintSSOToken).not.toHaveBeenCalled()
  })

  it('ignores a message whose event.source is not this iframe\'s contentWindow (a different frame spoofing the origin)', async () => {
    const { ref } = makeIframeRef() // ref.current's contentWindow is the "real" iframe
    const otherIframe = document.createElement('iframe')
    document.body.appendChild(otherIframe)
    const integration = fakeIntegration()

    renderHook(() => useSsoHandshake(ref, integration))

    // Message *claims* the allowed origin, but comes from a different window.
    dispatchMessage(otherIframe.contentWindow, 'https://partner.example.com', { type: 'wf:sso:request' })
    await new Promise((r) => setTimeout(r, 20))
    expect(integrationsApi.mintSSOToken).not.toHaveBeenCalled()
  })

  it('does nothing when auth_mode is not signed_launch (no listener installed)', async () => {
    const { iframe, ref } = makeIframeRef()
    const integration = fakeIntegration({ auth_mode: 'none' })

    renderHook(() => useSsoHandshake(ref, integration))

    dispatchMessage(iframe.contentWindow, 'https://partner.example.com', { type: 'wf:sso:request' })
    await new Promise((r) => setTimeout(r, 20))
    expect(integrationsApi.mintSSOToken).not.toHaveBeenCalled()
  })

  it('does nothing when integration is undefined', async () => {
    const { iframe, ref } = makeIframeRef()

    renderHook(() => useSsoHandshake(ref, undefined))

    dispatchMessage(iframe.contentWindow, 'https://partner.example.com', { type: 'wf:sso:request' })
    await new Promise((r) => setTimeout(r, 20))
    expect(integrationsApi.mintSSOToken).not.toHaveBeenCalled()
  })

  it('resizes the iframe on a wf:resize message from an allowed origin', async () => {
    const { iframe, ref } = makeIframeRef()
    const integration = fakeIntegration()

    renderHook(() => useSsoHandshake(ref, integration))

    dispatchMessage(iframe.contentWindow, 'https://partner.example.com', { type: 'wf:resize', height: 480 })
    await vi.waitFor(() => expect(iframe.style.height).toBe('480px'))
  })

  it('ignores a wf:resize from a disallowed origin', async () => {
    const { iframe, ref } = makeIframeRef()
    const integration = fakeIntegration()

    renderHook(() => useSsoHandshake(ref, integration))

    dispatchMessage(iframe.contentWindow, 'https://evil.example.com', { type: 'wf:resize', height: 999 })
    await new Promise((r) => setTimeout(r, 20))
    expect(iframe.style.height).not.toBe('999px')
  })

  it('removes its message listener on unmount (no mint after unmount)', async () => {
    const { iframe, ref } = makeIframeRef()
    const integration = fakeIntegration()

    const { unmount } = renderHook(() => useSsoHandshake(ref, integration))
    unmount()

    dispatchMessage(iframe.contentWindow, 'https://partner.example.com', { type: 'wf:sso:request' })
    await new Promise((r) => setTimeout(r, 20))
    expect(integrationsApi.mintSSOToken).not.toHaveBeenCalled()
  })
})
