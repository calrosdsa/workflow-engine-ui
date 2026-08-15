import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkEmbeddable } from '@/lib/api'
import { integrationsApi } from '@/features/integrations/api'
import { parsePageSchema } from '@/features/page-builder/serialize'
import type { PageComponent } from '@/features/page-builder/schema'
import type { Menu, CustomMenuConfig } from '../types'

interface CustomMenuRuntimeProps {
  menu: Menu
  clientId: string
  appId: string
  menus?: Menu[]
  onNavigate?: (slug: string) => void
}

// Branches on config.mode first. 'embed' renders an iframe, pre-checked
// against the backend's /embed-check endpoint (see EmbedFrame below) — a
// client-side load-timeout heuristic was tried first and confirmed broken
// (a blocked iframe still fires the DOM `load` event normally in Chromium,
// so the timeout never trips for the majority-browser case), which is why
// this calls a deterministic, headers-based server check instead. 'page'
// does the section/column/component traversal, near-identical to
// features/forms/runtime/FormRenderer.tsx's sections.map -> columns.map
// (flex ratio) -> elements.map, minus all react-hook-form/validation
// machinery since PageComponents carry no data.
export function CustomMenuRuntime({ menu, onNavigate }: CustomMenuRuntimeProps) {
  const config = menu.config as CustomMenuConfig
  const mode = config.mode ?? 'page'

  if (mode === 'embed') {
    return <EmbedFrame url={config.embedUrl ?? ''} integrationId={config.integrationId} />
  }

  const schema = parsePageSchema(config.schema)

  if (schema.sections.length === 0) {
    return <div className="p-6 text-sm text-gray-400">"{menu.name}" has no content yet.</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {schema.sections.map((section) => (
        <div key={section.id} className="flex gap-4">
          {section.columns.map((column) => (
            <div key={column.id} style={{ flex: column.ratio }} className="min-w-0 space-y-4">
              {column.components.map((c) => (
                <RuntimeComponent key={c.id} component={c} onNavigate={onNavigate} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page-mode component dispatch
// ---------------------------------------------------------------------------

const BUTTON_VARIANT_MAP = {
  primary: 'default',
  secondary: 'ghost',
  outline: 'outline',
} as const

function RuntimeComponent({ component, onNavigate }: { component: PageComponent; onNavigate?: (slug: string) => void }) {
  switch (component.component) {
    case 'divider':
      return <hr style={{ borderColor: 'hsl(var(--border))' }} />
    case 'spacer':
      return <div style={{ height: component.height ?? 24 }} aria-hidden />
    case 'heading': {
      const Tag = (`h${component.level ?? 2}`) as 'h1' | 'h2' | 'h3'
      const sizes = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl' }
      return <Tag className={`font-semibold ${sizes[component.level ?? 2]}`} style={{ color: 'hsl(var(--foreground))' }}>{component.text}</Tag>
    }
    case 'paragraph':
      return <p className="leading-relaxed" style={{ color: 'hsl(var(--foreground))' }}>{component.text}</p>
    case 'image':
      if (!component.src) return null
      return (
        <img
          src={component.src}
          alt={component.alt ?? ''}
          className={{ full: 'w-full', half: 'w-1/2', third: 'w-1/3', auto: 'w-auto' }[component.width ?? 'full']}
        />
      )
    case 'button': {
      const handleClick = () => {
        if (component.linkType === 'menu' && component.menuSlug) onNavigate?.(component.menuSlug)
      }
      if (component.linkType === 'external' && component.url) {
        return (
          <a href={component.url} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant={BUTTON_VARIANT_MAP[component.variant ?? 'primary']}>{component.label || 'Button'}</Button>
          </a>
        )
      }
      return (
        <Button type="button" variant={BUTTON_VARIANT_MAP[component.variant ?? 'primary']} onClick={handleClick}>
          {component.label || 'Button'}
        </Button>
      )
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Embed mode
// ---------------------------------------------------------------------------

type EmbedStatus = 'checking' | 'embeddable' | 'blocked'

/** Renders an embedded external webpage full-bleed, after confirming via the
 *  backend's /embed-check endpoint that the URL's response headers actually
 *  allow framing. Calling checkEmbeddable() BEFORE rendering the iframe
 *  (rather than rendering optimistically and reacting to a load event) is
 *  the whole point — there is no reliable in-browser signal to react to, so
 *  the decision has to be made ahead of time from the real headers.
 *
 *  When `integrationId` references a `signed_launch` Embedded Integration,
 *  mints a token and appends it to the iframe's src as a `#sso_token=`
 *  fragment — same mode-A delivery as the Dashboard embed widget's
 *  Renderer.tsx (FR-D3-003, mode A), and the same mint-first-with-uniform-fallback
 *  approach the Android runtime uses (EmbedWidgetEntry.kt) rather than the
 *  Dashboard widget's pre-check-then-mint shape. That's a deliberate,
 *  necessary divergence, not an inconsistency: GET /integrations and
 *  GET /integrations/{id} both require credentials:read (a builder/admin
 *  permission), which an ordinary runtime end-user session viewing this
 *  page will typically NOT hold — pre-checking auth_mode via useIntegrations()
 *  the way the Dashboard widget does would silently and permanently disable
 *  SSO for exactly the audience this page is for. Minting directly sidesteps
 *  that: POST /integrations/{id}/sso-token itself only requires menus:read
 *  (see api/handler.go's route table), which this page's own viewer already
 *  has by definition. Any mint failure (wrong auth_mode, integration not
 *  found, insufficient permission, network error) is treated uniformly as
 *  "fall back to the plain, non-SSO URL" — matching FR-D3-003's FRAG-04
 *  silent-fallback behavior, and matching the Android implementation exactly.
 *
 *  This also means mode B (the Embed SDK's postMessage handshake / requestToken())
 *  is intentionally NOT wired up here — it needs the integration's
 *  allowed_origins for the parent-side origin check, which lives behind the
 *  same credentials:read gate. A page embedded here that calls
 *  WorkflowEmbed.requestToken() will see it silently no-op (safe, documented
 *  behavior — see public/embed-sdk.js); it should rely on the mode-A token
 *  already present in the fragment plus onExpiring() to prompt a reload
 *  instead. The Dashboard embed widget, authored by builder/admin users who
 *  DO hold credentials:read, keeps mode B. */
function EmbedFrame({ url, integrationId }: { url: string; integrationId?: string }) {
  const [status, setStatus] = useState<EmbedStatus>('checking')
  const [reason, setReason] = useState<string | undefined>()
  const [launchUrl, setLaunchUrl] = useState(url)

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

  useEffect(() => {
    if (!integrationId) {
      setLaunchUrl(url)
      return
    }
    let cancelled = false
    integrationsApi.mintSSOToken(integrationId)
      .then((res) => {
        if (cancelled) return
        setLaunchUrl(`${url}#sso_token=${encodeURIComponent(res.token)}`)
      })
      .catch(() => {
        if (cancelled) return
        setLaunchUrl(url) // mint failed for any reason (wrong auth_mode, not found, permission, network) — fall back to a plain, non-SSO launch
      })
    return () => { cancelled = true }
  }, [url, integrationId])

  if (!url) {
    return <div className="p-6 text-sm text-gray-400">No webpage URL has been configured for this page yet.</div>
  }

  if (status === 'checking') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white p-6 text-center">
        <ExternalLink size={32} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-700">This page can't be displayed here</p>
        {reason && <p className="max-w-sm text-xs text-gray-400">{reason}</p>}
        {/* min-h-11 (44px) matches the platform touch-target floor — this
            is the one control on this screen a phone user has to hit. */}
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button type="button" size="sm" className="min-h-11 gap-1.5 px-4">
            <ExternalLink size={13} /> Open in a new tab
          </Button>
        </a>
      </div>
    )
  }

  return <iframe key={launchUrl} src={launchUrl} title="Embedded page" className="h-full w-full border-0" />
}
