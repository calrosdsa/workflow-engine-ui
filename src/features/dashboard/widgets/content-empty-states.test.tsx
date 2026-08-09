// @vitest-environment jsdom
//
// Confirms the builder-only "empty content" placeholders added during the
// Phase 8 empty/error-states audit actually render — these guard the case
// where a heading/paragraph/richtext widget's text has been cleared to ""
// and would otherwise render zero visible pixels (all three use 'plain'
// chrome), leaving a builder-mode tile impossible to locate by eye. Also
// covers ImageRenderer's onError fallback for a broken image URL.
//
// No global setup file wires @testing-library/react's auto-cleanup in this
// project (same as useSsoHandshake.test.tsx/useIsVisible.test.tsx), and
// render() defaults to mounting into document.body with queries bound to
// that shared body — so every render() in this file is explicitly
// unmounted before the next one, or scoped via each render result's own
// `container` query, to avoid one test's DOM leaking into another's query.
import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup, within } from '@testing-library/react'
import { HeadingRenderer } from './heading/Renderer'
import { ParagraphRenderer } from './paragraph/Renderer'
import { RichTextRenderer } from './richtext/Renderer'
import { ImageRenderer } from './image/Renderer'
import type { WidgetInstance } from '../schema'

afterEach(() => cleanup())

const baseInstance: WidgetInstance = { id: 'w1', type: 'test', layout: { x: 0, y: 0, w: 1, h: 1 }, chrome: 'plain', config: {} }
const commonProps = { instance: baseInstance, clientId: '', appId: '' }

describe('content widget empty states (builder mode only)', () => {
  it('HeadingRenderer shows a placeholder for empty text in builder mode, but renders normally at runtime', () => {
    const empty = { text: '', level: 2 as const }
    const builder = render(<HeadingRenderer config={empty} mode="builder" {...commonProps} />)
    expect(within(builder.container).getByText(/Empty heading/i)).toBeTruthy()
    builder.unmount()

    const runtime = render(<HeadingRenderer config={empty} mode="runtime" {...commonProps} />)
    expect(within(runtime.container).queryByText(/Empty heading/i)).toBeNull()
  })

  it('HeadingRenderer renders the real heading when text is present', () => {
    const { container } = render(<HeadingRenderer config={{ text: 'Hello', level: 1 }} mode="builder" {...commonProps} />)
    const heading = within(container).getByText('Hello')
    expect(heading.tagName).toBe('H1')
    expect(within(container).queryByText(/Empty heading/i)).toBeNull()
  })

  it('ParagraphRenderer shows a placeholder for empty text in builder mode only', () => {
    const empty = { text: '' }
    const builder = render(<ParagraphRenderer config={empty} mode="builder" {...commonProps} />)
    expect(within(builder.container).getByText(/Empty paragraph/i)).toBeTruthy()
    builder.unmount()

    const runtime = render(<ParagraphRenderer config={empty} mode="runtime" {...commonProps} />)
    expect(within(runtime.container).queryByText(/Empty paragraph/i)).toBeNull()
  })

  it('RichTextRenderer shows a placeholder for empty/whitespace-only markdown in builder mode only', () => {
    const builder = render(<RichTextRenderer config={{ markdown: '   ' }} mode="builder" {...commonProps} />)
    expect(within(builder.container).getByText(/Empty — click to add Markdown/i)).toBeTruthy()
    builder.unmount()

    const runtime = render(<RichTextRenderer config={{ markdown: '' }} mode="runtime" {...commonProps} />)
    expect(within(runtime.container).queryByText(/Empty — click to add Markdown/i)).toBeNull()
  })

  it('RichTextRenderer renders real markdown as semantic HTML when present', () => {
    const { container } = render(<RichTextRenderer config={{ markdown: '## Hi' }} mode="builder" {...commonProps} />)
    expect(container.querySelector('h2')?.textContent).toBe('Hi')
  })
})

describe('ImageRenderer empty/error states', () => {
  it('shows "No image URL set yet" when src is empty', () => {
    const { container } = render(<ImageRenderer config={{ src: '', alt: '', width: 'full' }} mode="builder" {...commonProps} />)
    expect(within(container).getByText(/No image URL set yet/i)).toBeTruthy()
  })

  it('shows a broken-image fallback after the <img> fires onError', () => {
    const { container } = render(
      <ImageRenderer config={{ src: 'https://example.com/broken.png', alt: 'a photo', width: 'full' }} mode="builder" {...commonProps} />,
    )
    const img = within(container).getByAltText('a photo')
    fireEvent.error(img)
    expect(within(container).getByText(/Couldn't load this image/i)).toBeTruthy()
  })

  it('clears the broken-image fallback once the src is corrected to a working one', () => {
    const config1 = { src: 'https://example.com/broken.png', alt: '', width: 'full' as const }
    const { rerender, container } = render(<ImageRenderer config={config1} mode="builder" {...commonProps} />)
    fireEvent.error(container.querySelector('img')!)
    expect(within(container).getByText(/Couldn't load this image/i)).toBeTruthy()

    const config2 = { src: 'https://example.com/working.png', alt: '', width: 'full' as const }
    rerender(<ImageRenderer config={config2} mode="builder" {...commonProps} />)
    expect(within(container).queryByText(/Couldn't load this image/i)).toBeNull()
  })
})
