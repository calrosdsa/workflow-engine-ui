// Mirrors internal/reports.ImageBlockConfig (Go, block_image.go) exactly.
export type ImageSourceKind = 'url' | 'content_id'

export interface ImageBlockConfig {
  source: ImageSourceKind
  url?: string
  content_id?: string
  alt?: string
}

export function emptyImageBlockConfig(): ImageBlockConfig {
  return { source: 'url', url: '' }
}

/** Defensive parse — never throws, heals a malformed/stale blob. */
export function parseImageBlockConfig(raw: unknown): ImageBlockConfig {
  const empty = emptyImageBlockConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const source = r.source === 'url' || r.source === 'content_id' ? r.source : empty.source
  return {
    source,
    url: typeof r.url === 'string' ? r.url : undefined,
    content_id: typeof r.content_id === 'string' ? r.content_id : undefined,
    alt: typeof r.alt === 'string' ? r.alt : undefined,
  }
}
