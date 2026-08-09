import { describe, it, expect } from 'vitest'
import { parseCustomHtmlConfig, createDefaultCustomHtmlConfig } from './schema'

describe('parseCustomHtmlConfig', () => {
  it('round-trips a valid config', () => {
    expect(parseCustomHtmlConfig({ mode: 'sandbox', html: '<p>hi</p>' })).toEqual({ mode: 'sandbox', html: '<p>hi</p>' })
  })

  it('falls back to defaults for garbage/legacy input', () => {
    expect(parseCustomHtmlConfig({})).toEqual(createDefaultCustomHtmlConfig())
    expect(parseCustomHtmlConfig(null)).toEqual(createDefaultCustomHtmlConfig())
    expect(parseCustomHtmlConfig('garbage')).toEqual(createDefaultCustomHtmlConfig())
  })

  it('heals an invalid mode to "inline"', () => {
    expect(parseCustomHtmlConfig({ mode: 'raw', html: '<p>x</p>' }).mode).toBe('inline')
  })

  it('createDefaultCustomHtmlConfig defaults to inline mode with empty html', () => {
    expect(createDefaultCustomHtmlConfig()).toEqual({ mode: 'inline', html: '' })
  })
})
