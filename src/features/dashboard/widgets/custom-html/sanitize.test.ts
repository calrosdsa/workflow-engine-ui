// @vitest-environment jsdom
//
// DOMPurify needs a real DOM to sanitize against, unlike the rest of this
// project's tests (default vitest environment is plain 'node' — see
// vitest.config.ts). This file opts into jsdom via the docblock above;
// every other test file is unaffected.
//
// This is the actual security boundary for the custom-HTML widget's
// 'inline' mode (docs/dashboard-system-plan.md section 5.5) — a config
// mistake here is a stored-XSS vulnerability against every viewer of the
// dashboard, so these assert against real attack payloads, not just "does
// it parse".
import { describe, it, expect } from 'vitest'
import { sanitizeInlineHtml } from './sanitize'

describe('sanitizeInlineHtml', () => {
  it('strips <script> tags entirely, including their content', () => {
    const out = sanitizeInlineHtml('<p>hello</p><script>alert(document.cookie)</script>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert')
    expect(out).toContain('hello')
  })

  it('strips inline event handler attributes (onerror, onload, onclick)', () => {
    expect(sanitizeInlineHtml('<img src="x" onerror="alert(1)">')).not.toContain('onerror')
    expect(sanitizeInlineHtml('<body onload="alert(1)">x</body>')).not.toContain('onload')
    expect(sanitizeInlineHtml('<div onclick="alert(1)">x</div>')).not.toContain('onclick')
  })

  it('strips <iframe>/<embed>/<object> — inline mode never gets its own iframe escape hatch', () => {
    expect(sanitizeInlineHtml('<iframe src="https://evil.example"></iframe>')).not.toContain('<iframe')
    expect(sanitizeInlineHtml('<embed src="https://evil.example">')).not.toContain('<embed')
    expect(sanitizeInlineHtml('<object data="https://evil.example"></object>')).not.toContain('<object')
  })

  it('strips <form>/<input>/<button> (CSRF-flavored / phishing-flavored risk)', () => {
    expect(sanitizeInlineHtml('<form action="https://evil.example"><input name="x"></form>')).not.toContain('<form')
    expect(sanitizeInlineHtml('<input type="text">')).not.toContain('<input')
    expect(sanitizeInlineHtml('<button onclick="x()">Click</button>')).not.toContain('<button')
  })

  it('strips javascript: URLs in href/src', () => {
    const out = sanitizeInlineHtml('<a href="javascript:alert(1)">click</a>')
    expect(out.toLowerCase()).not.toContain('javascript:')
  })

  it('strips <link>/<meta> (no CSS/meta-refresh injection)', () => {
    expect(sanitizeInlineHtml('<link rel="stylesheet" href="https://evil.example/x.css">')).not.toContain('<link')
    expect(sanitizeInlineHtml('<meta http-equiv="refresh" content="0;url=https://evil.example">')).not.toContain('<meta')
  })

  it('preserves ordinary formatted content unchanged in structure', () => {
    const out = sanitizeInlineHtml('<h2>Title</h2><p>Some <strong>bold</strong> and <a href="https://example.com">a link</a>.</p>')
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('href="https://example.com"')
  })

  it('preserves images with alt text', () => {
    const out = sanitizeInlineHtml('<img src="https://example.com/x.png" alt="a photo">')
    expect(out).toContain('src="https://example.com/x.png"')
    expect(out).toContain('alt="a photo"')
  })

  it('strips a nested/obfuscated script attempt (case variation, mixed tags)', () => {
    const out = sanitizeInlineHtml('<ScRiPt>alert(1)</sCriPt><svg onload=alert(1)>')
    expect(out.toLowerCase()).not.toContain('<script')
    expect(out.toLowerCase()).not.toContain('onload')
  })
})
