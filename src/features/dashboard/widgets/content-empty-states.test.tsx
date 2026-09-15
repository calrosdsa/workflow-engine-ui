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
import type { ReactElement } from 'react'
import { HeadingRenderer } from './heading/Renderer'
import { ParagraphRenderer } from './paragraph/Renderer'
import { RichTextRenderer } from './richtext/Renderer'
import { ImageRenderer } from './image/Renderer'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { WidgetInstance } from '../schema'

afterEach(() => cleanup())

const baseInstance: WidgetInstance = { id: 'w1', type: 'test', layout: { x: 0, y: 0, w: 1, h: 1 }, chrome: 'plain', config: {} }
const commonProps = { instance: baseInstance, clientId: '', appId: '' }

// HeadingRenderer (and, once migrated, ParagraphRenderer/RichTextRenderer/
// ImageRenderer) calls useTranslation, which throws outside an I18nProvider
// ancestor — real provider, no props, same pattern as InsertDataMenu.test.tsx.
// Every render() in this file goes through this helper so a widget gaining
// useTranslation() later doesn't quietly re-break this shared test file.
function widgetTree(ui: ReactElement) {
  return <I18nProvider>{ui}</I18nProvider>
}
function renderWidget(ui: ReactElement) {
  return render(widgetTree(ui))
}

describe('content widget empty states (builder mode only)', () => {
  it('HeadingRenderer shows a placeholder for empty text in builder mode, but renders normally at runtime', () => {
    const empty = { text: '', level: 2 as const }
    const builder = renderWidget(<HeadingRenderer config={empty} mode="builder" {...commonProps} />)
    expect(within(builder.container).getByText(/Empty heading/i)).toBeTruthy()
    builder.unmount()

    const runtime = renderWidget(<HeadingRenderer config={empty} mode="runtime" {...commonProps} />)
    expect(within(runtime.container).queryByText(/Empty heading/i)).toBeNull()
  })

  it('HeadingRenderer renders the real heading when text is present', () => {
    const { container } = renderWidget(<HeadingRenderer config={{ text: 'Hello', level: 1 }} mode="builder" {...commonProps} />)
    const heading = within(container).getByText('Hello')
    expect(heading.tagName).toBe('H1')
    expect(within(container).queryByText(/Empty heading/i)).toBeNull()
  })

  it('ParagraphRenderer shows a placeholder for empty text in builder mode only', () => {
    const empty = { text: '' }
    const builder = renderWidget(<ParagraphRenderer config={empty} mode="builder" {...commonProps} />)
    expect(within(builder.container).getByText(/Empty paragraph/i)).toBeTruthy()
    builder.unmount()

    const runtime = renderWidget(<ParagraphRenderer config={empty} mode="runtime" {...commonProps} />)
    expect(within(runtime.container).queryByText(/Empty paragraph/i)).toBeNull()
  })

  it('RichTextRenderer shows a placeholder for empty/whitespace-only markdown in builder mode only', () => {
    const builder = renderWidget(<RichTextRenderer config={{ markdown: '   ' }} mode="builder" {...commonProps} />)
    expect(within(builder.container).getByText(/Empty — click to add Markdown/i)).toBeTruthy()
    builder.unmount()

    const runtime = renderWidget(<RichTextRenderer config={{ markdown: '' }} mode="runtime" {...commonProps} />)
    expect(within(runtime.container).queryByText(/Empty — click to add Markdown/i)).toBeNull()
  })

  it('RichTextRenderer renders real markdown as semantic HTML when present', () => {
    const { container } = renderWidget(<RichTextRenderer config={{ markdown: '## Hi' }} mode="builder" {...commonProps} />)
    expect(container.querySelector('h2')?.textContent).toBe('Hi')
  })
})

describe('ImageRenderer empty/error states', () => {
  it('shows "No image URL set yet" when src is empty', () => {
    const { container } = renderWidget(<ImageRenderer config={{ src: '', alt: '', width: 'full' }} mode="builder" {...commonProps} />)
    expect(within(container).getByText(/No image URL set yet/i)).toBeTruthy()
  })

  it('shows a broken-image fallback after the <img> fires onError', () => {
    const { container } = renderWidget(
      <ImageRenderer config={{ src: 'https://example.com/broken.png', alt: 'a photo', width: 'full' }} mode="builder" {...commonProps} />,
    )
    const img = within(container).getByAltText('a photo')
    fireEvent.error(img)
    expect(within(container).getByText(/Couldn't load this image/i)).toBeTruthy()
  })

  it('clears the broken-image fallback once the src is corrected to a working one', () => {
    const config1 = { src: 'https://example.com/broken.png', alt: '', width: 'full' as const }
    const { rerender, container } = renderWidget(<ImageRenderer config={config1} mode="builder" {...commonProps} />)
    fireEvent.error(container.querySelector('img')!)
    expect(within(container).getByText(/Couldn't load this image/i)).toBeTruthy()

    const config2 = { src: 'https://example.com/working.png', alt: '', width: 'full' as const }
    rerender(widgetTree(<ImageRenderer config={config2} mode="builder" {...commonProps} />))
    expect(within(container).queryByText(/Couldn't load this image/i)).toBeNull()
  })
})
