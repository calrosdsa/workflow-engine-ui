import { describe, it, expect } from 'vitest'
import { isAllowedHost, sanitizeHosts, buildCsp, buildThemeCss, composeSrcDoc } from './srcdoc'

describe('isAllowedHost', () => {
  it('accepts ordinary hosts, schemes, ports and wildcard labels', () => {
    for (const h of [
      'cdn.example.com', 'https://cdn.example.com', 'http://api.example.co.uk',
      '*.tiles.example.com', 'api.example.com:8443',
    ]) expect(isAllowedHost(h), h).toBe(true)
  })

  it('rejects anything that could carry a second CSP directive', () => {
    // The attack this pattern exists for: escaping the directive it sits in.
    for (const h of [
      "cdn.example.com; script-src *",
      'cdn.example.com evil.com',
      "*", "'unsafe-eval'", 'data:', 'javascript:alert(1)',
      'cdn.example.com/path', 'user:pass@cdn.example.com',
      'cdn.example.com"', '', '   ',
    ]) expect(isAllowedHost(h), h).toBe(false)
  })

  it('rejects a bare hostname with no dot', () => {
    expect(isAllowedHost('localhost')).toBe(false)
  })
})

describe('sanitizeHosts', () => {
  it('drops invalid entries and de-duplicates, preserving order', () => {
    expect(sanitizeHosts(['b.example.com', 'bad;host', 'a.example.com', 'b.example.com', '']))
      .toEqual(['b.example.com', 'a.example.com'])
  })
})

describe('buildCsp', () => {
  it('denies everything outward when no host is declared', () => {
    const csp = buildCsp([])
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).toContain("base-uri 'none'")
  })

  it('permits only the declared hosts on connect-src', () => {
    const csp = buildCsp(['cdn.example.com', 'api.example.com'])
    expect(csp).toContain('connect-src cdn.example.com api.example.com')
  })

  it('allows the page its own inline script and style', () => {
    // Safe only because the origin is opaque — see buildCsp's doc comment.
    const csp = buildCsp([])
    expect(csp).toContain("script-src 'unsafe-inline'")
    expect(csp).toContain("style-src 'unsafe-inline'")
  })

  it('never lets an injected host widen the policy', () => {
    const csp = buildCsp(["evil.com; default-src *"])
    expect(csp).not.toContain('default-src *')
    expect(csp).toContain("connect-src 'none'")
  })
})

describe('buildThemeCss', () => {
  it('emits a :root block for real token values', () => {
    expect(buildThemeCss({ '--primary': '217 91% 60%', '--radius': '0.5rem' }))
      .toBe(':root{--primary: 217 91% 60%;--radius: 0.5rem;}')
  })

  it('drops values that could break out of the style block', () => {
    expect(buildThemeCss({ '--primary': '</style><script>alert(1)</script>' })).toBe('')
    expect(buildThemeCss({ '--x': 'red}body{display:none' })).toBe('')
  })

  it('ignores non-token keys and empty values', () => {
    expect(buildThemeCss({ color: 'red', '--a': '' })).toBe('')
  })
})

describe('composeSrcDoc', () => {
  const base = { html: '<p>hi</p>', themeValues: { '--primary': '10 20% 30%' }, allowedHosts: [], sourceIds: [] }

  it('puts the CSP meta before any author markup', () => {
    const doc = composeSrcDoc({ ...base, html: '<p>author</p>' })
    // Load-bearing: a meta CSP only governs what follows it.
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<p>author</p>'))
  })

  it('passes author HTML through verbatim — the sandbox is the boundary', () => {
    const html = '<script>window.x=1</script><div onclick="go()">z</div>'
    expect(composeSrcDoc({ ...base, html })).toContain(html)
  })

  it('injects the theme tokens', () => {
    expect(composeSrcDoc(base)).toContain('--primary: 10 20% 30%;')
  })

  it('exposes declared source ids to the in-frame helper', () => {
    const doc = composeSrcDoc({ ...base, sourceIds: ['tasks', 'people'] })
    expect(doc).toContain('["tasks","people"]')
    expect(doc).toContain('window.AppBuilder')
  })

  it('is a complete document', () => {
    const doc = composeSrcDoc(base)
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('</html>')
  })
})
