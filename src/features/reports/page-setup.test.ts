import { describe, expect, it } from 'vitest'
import { unknownTokens, validatePageSetup } from './page-setup'
import type { PageSetup } from './types'

describe('unknownTokens', () => {
  it('finds no tokens in plain text', () => {
    expect(unknownTokens('Board pack')).toEqual([])
  })

  it('recognizes every PAGE_BAND_TOKENS entry', () => {
    expect(unknownTokens('{{page}} of {{pages}} — {{report_name}}, {{generated_at}}')).toEqual([])
  })

  it('flags a token PAGE_BAND_TOKENS does not recognize', () => {
    expect(unknownTokens('Region: {{region}}')).toEqual(['region'])
  })

  it('deduplicates a repeated unknown token', () => {
    expect(unknownTokens('{{bogus}} ... {{bogus}}')).toEqual(['bogus'])
  })

  it('is empty for undefined text', () => {
    expect(unknownTokens(undefined)).toEqual([])
  })
})

describe('validatePageSetup', () => {
  it('is empty when page is undefined — nothing to validate', () => {
    expect(validatePageSetup(undefined)).toEqual([])
  })

  it('is empty for a fully valid page setup', () => {
    const page: PageSetup = { paper_size: 'a4', header: { center: '{{report_name}}' } }
    expect(validatePageSetup(page)).toEqual([])
  })

  it('flags a custom paper size missing both dimensions', () => {
    const page: PageSetup = { paper_size: 'custom' }
    expect(validatePageSetup(page)).toEqual([{ key: 'reports.page_setup.custom_size_required' }])
  })

  it('flags a custom paper size missing only height', () => {
    const page: PageSetup = { paper_size: 'custom', custom_width_mm: 100 }
    expect(validatePageSetup(page)).toEqual([{ key: 'reports.page_setup.custom_size_required' }])
  })

  it('does not flag a complete custom paper size', () => {
    const page: PageSetup = { paper_size: 'custom', custom_width_mm: 100, custom_height_mm: 150 }
    expect(validatePageSetup(page)).toEqual([])
  })

  it('flags an unrecognized token in the header', () => {
    const page: PageSetup = { header: { left: 'Hello {{bogus}}' } }
    expect(validatePageSetup(page)).toEqual([
      { key: 'reports.page_setup.unknown_token', params: { token: 'bogus' } },
    ])
  })

  it('flags an unrecognized token in the footer', () => {
    const page: PageSetup = { footer: { right: '{{nope}}' } }
    expect(validatePageSetup(page)).toEqual([
      { key: 'reports.page_setup.unknown_token', params: { token: 'nope' } },
    ])
  })

  it('merges unrecognized tokens found across every header/footer zone into one problem', () => {
    const page: PageSetup = {
      header: { left: '{{a}}', center: '{{page}}', right: '{{b}}' },
      footer: { left: '{{a}}' }, // duplicate of header's — must not appear twice
    }
    const problems = validatePageSetup(page)
    expect(problems).toHaveLength(1)
    expect(problems[0].key).toBe('reports.page_setup.unknown_token')
    expect(problems[0].params?.token.split(', ').sort()).toEqual(['a', 'b'])
  })

  it('reports both problems together when the page has both', () => {
    const page: PageSetup = { paper_size: 'custom', header: { left: '{{bogus}}' } }
    const problems = validatePageSetup(page)
    expect(problems.map((p) => p.key)).toEqual([
      'reports.page_setup.custom_size_required',
      'reports.page_setup.unknown_token',
    ])
  })
})
