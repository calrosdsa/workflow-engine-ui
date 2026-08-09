import { describe, it, expect } from 'vitest'
import { parseHeadingConfig, createDefaultHeadingConfig } from './heading/schema'
import { parseParagraphConfig, createDefaultParagraphConfig } from './paragraph/schema'
import { parseRichTextConfig, createDefaultRichTextConfig } from './richtext/schema'
import { parseImageConfig, createDefaultImageConfig } from './image/schema'
import { parseSpacerConfig, createDefaultSpacerConfig } from './spacer/schema'
import { parseButtonConfig, createDefaultButtonConfig } from './button/schema'
import { parseQuickLinksConfig, createDefaultQuickLinksConfig } from './quick-links/schema'

// Each content widget's parseConfig must never throw and must fall back to
// its own createDefaultConfig() for garbage/legacy input — the same
// contract widget-contract.ts documents for parseConfig, and the thing that
// keeps a widget instance from crashing the whole canvas over one bad blob.
describe('content widget config parsers', () => {
  it('heading: round-trips valid input, heals invalid level, falls back on garbage', () => {
    expect(parseHeadingConfig({ text: 'Hi', level: 1 })).toEqual({ text: 'Hi', level: 1 })
    expect(parseHeadingConfig({ text: 'Hi', level: 99 })).toEqual({ text: 'Hi', level: 2 })
    expect(parseHeadingConfig(null)).toEqual(createDefaultHeadingConfig())
    expect(parseHeadingConfig('garbage')).toEqual(createDefaultHeadingConfig())
    expect(parseHeadingConfig({})).toEqual(createDefaultHeadingConfig())
  })

  it('paragraph: round-trips valid input, falls back on garbage', () => {
    expect(parseParagraphConfig({ text: 'Body' })).toEqual({ text: 'Body' })
    expect(parseParagraphConfig(undefined)).toEqual(createDefaultParagraphConfig())
    expect(parseParagraphConfig(42)).toEqual(createDefaultParagraphConfig())
  })

  it('richtext: round-trips valid input, falls back on garbage', () => {
    expect(parseRichTextConfig({ markdown: '# Hi' })).toEqual({ markdown: '# Hi' })
    expect(parseRichTextConfig([])).toEqual(createDefaultRichTextConfig())
  })

  it('image: round-trips valid input, heals invalid width, falls back on garbage', () => {
    expect(parseImageConfig({ src: 'x.png', alt: 'x', width: 'half' })).toEqual({ src: 'x.png', alt: 'x', width: 'half' })
    expect(parseImageConfig({ src: 'x.png', width: 'bogus' })).toEqual({ src: 'x.png', alt: '', width: 'full' })
    expect(parseImageConfig(null)).toEqual(createDefaultImageConfig())
  })

  it('spacer: round-trips valid input, falls back on garbage', () => {
    expect(parseSpacerConfig({ height: 40 })).toEqual({ height: 40 })
    expect(parseSpacerConfig({ height: '40' })).toEqual(createDefaultSpacerConfig())
  })

  it('button: round-trips valid input, heals invalid linkType/variant, falls back on garbage', () => {
    expect(parseButtonConfig({ label: 'Go', linkType: 'menu', menuSlug: 'home', variant: 'outline' }))
      .toEqual({ label: 'Go', linkType: 'menu', menuSlug: 'home', url: undefined, variant: 'outline' })
    expect(parseButtonConfig({ label: 'Go', linkType: 'bogus', variant: 'bogus' }))
      .toEqual({ label: 'Go', linkType: 'external', menuSlug: undefined, url: undefined, variant: 'primary' })
    expect(parseButtonConfig(null)).toEqual(createDefaultButtonConfig())
  })

  it('quick-links: round-trips valid links, drops malformed link entries, falls back on garbage', () => {
    const valid = { display: 'grid', links: [{ id: '1', label: 'Home', kind: 'menu', menuSlug: 'home' }] }
    expect(parseQuickLinksConfig(valid)).toEqual(valid)

    const mixed = {
      display: 'list',
      links: [
        { id: '1', label: 'Ok', kind: 'url', url: 'https://x.com' },
        { id: '2', label: 'Bad — no kind' },
        'not-an-object',
      ],
    }
    const parsed = parseQuickLinksConfig(mixed)
    expect(parsed.links).toEqual([{ id: '1', label: 'Ok', kind: 'url', url: 'https://x.com' }])

    expect(parseQuickLinksConfig(undefined)).toEqual(createDefaultQuickLinksConfig())
  })
})
