export interface EmbedWidgetConfig {
  url: string
  /** When set, references a registered Embedded Integration
   *  (features/integrations) — the tile becomes SSO-aware: the launch URL
   *  gets a signed token appended as a URL fragment, and the Renderer
   *  answers the Embed SDK's postMessage handshake for that integration's
   *  allowed_origins. Unset = a plain embed with no identity pass-through,
   *  identical to the Custom menu's existing 'embed' mode. */
  integrationId?: string
}

export function parseEmbedConfig(raw: unknown): EmbedWidgetConfig {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<EmbedWidgetConfig>
    if (typeof r.url === 'string') {
      return { url: r.url, integrationId: typeof r.integrationId === 'string' && r.integrationId ? r.integrationId : undefined }
    }
  }
  return createDefaultEmbedConfig()
}

export function createDefaultEmbedConfig(): EmbedWidgetConfig {
  return { url: '' }
}
