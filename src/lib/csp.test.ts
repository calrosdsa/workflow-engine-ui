import { describe, it, expect } from 'vitest'
import { buildAppCsp, cspMetaTag } from './csp'

const prod = buildAppCsp({ dev: false })
const dev = buildAppCsp({ dev: true })

describe('buildAppCsp', () => {
  it('never allows a wildcard script source', () => {
    // The single most important property: an injected script must not be
    // able to load its payload from anywhere it likes.
    expect(prod).not.toMatch(/script-src[^;]*\*/)
    expect(prod).toContain("script-src 'self' 'unsafe-inline'")
  })

  it('locks the directives that blunt injection', () => {
    expect(prod).toContain("object-src 'none'")
    expect(prod).toContain("base-uri 'self'")
    expect(prod).toContain("form-action 'self'")
    expect(prod).toContain("default-src 'self'")
  })

  it('keeps unsafe-eval out of production', () => {
    expect(prod).not.toContain("'unsafe-eval'")
    // Dev needs it for Vite's transform pipeline.
    expect(dev).toContain("'unsafe-eval'")
  })

  it('allows inline styles, which theming requires', () => {
    // ThemeProvider applies the palette via element.style.setProperty, and
    // inline style attributes are CSP-governed — without this, theming dies.
    expect(prod).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('permits the runtime-only origins the app cannot enumerate', () => {
    // Presigned content (S3/Garage) and the Centrifugo websocket.
    expect(prod).toMatch(/img-src[^;]*https:/)
    expect(prod).toMatch(/connect-src[^;]*wss:/)
  })

  it('adds plain http/ws only in development', () => {
    expect(dev).toMatch(/connect-src[^;]*ws:/)
    expect(prod).not.toMatch(/connect-src[^;]*\bws:/)
    expect(dev).toMatch(/img-src[^;]*http:/)
  })

  it('leaves frame-src open enough for embeds and sandboxed pages', () => {
    // Embedded Integrations, the embed widget and HTML menus all frame
    // author-chosen or srcdoc content — narrowing this breaks features.
    expect(prod).toMatch(/frame-src[^;]*https:/)
    expect(prod).toMatch(/frame-src[^;]*blob:/)
  })

  it('omits directives a meta tag cannot deliver', () => {
    // frame-ancestors / report-uri / sandbox are header-only by spec —
    // listing them here would look like protection while doing nothing.
    for (const ignored of ['frame-ancestors', 'report-uri', 'report-to', 'sandbox']) {
      expect(prod).not.toContain(ignored)
    }
  })
})

describe('cspMetaTag', () => {
  it('produces a well-formed meta element', () => {
    const tag = cspMetaTag({ dev: false })
    expect(tag.startsWith('<meta http-equiv="Content-Security-Policy" content="')).toBe(true)
    expect(tag.endsWith('">')).toBe(true)
    // A stray double quote in a directive would truncate the attribute and
    // silently drop everything after it. Extract the value rather than
    // counting characters.
    const content = tag.match(/content="([^"]*)"/)?.[1]
    expect(content).toBe(buildAppCsp({ dev: false }))
  })
})
