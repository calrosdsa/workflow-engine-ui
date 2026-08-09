import { describe, it, expect } from 'vitest'
import { parseEmbedConfig, createDefaultEmbedConfig } from './schema'

describe('parseEmbedConfig', () => {
  it('round-trips a valid config with an integrationId', () => {
    expect(parseEmbedConfig({ url: 'https://x.com', integrationId: 'integ-1' })).toEqual({ url: 'https://x.com', integrationId: 'integ-1' })
  })

  it('round-trips a valid config with no integrationId', () => {
    expect(parseEmbedConfig({ url: 'https://x.com' })).toEqual({ url: 'https://x.com', integrationId: undefined })
  })

  it('falls back to defaults for garbage/legacy input', () => {
    expect(parseEmbedConfig({})).toEqual(createDefaultEmbedConfig())
    expect(parseEmbedConfig(null)).toEqual(createDefaultEmbedConfig())
    expect(parseEmbedConfig('garbage')).toEqual(createDefaultEmbedConfig())
  })

  it('treats an empty-string integrationId as unset', () => {
    expect(parseEmbedConfig({ url: 'https://x.com', integrationId: '' }).integrationId).toBeUndefined()
  })

  it('createDefaultEmbedConfig has an empty url and no integrationId', () => {
    expect(createDefaultEmbedConfig()).toEqual({ url: '' })
  })
})
