// @vitest-environment jsdom
//
// One widget failing to render used to replace the WHOLE dashboard page with
// the router's "Something went wrong!" — a stat tile reading a group key the
// response did not have took down every tile beside it, navigation included.
// These pin the containment: the failure stays in its tile, the rest of the
// page renders, and the tile retries once what it renders from changes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { WidgetBody, WidgetErrorBoundary } from './WidgetErrorBoundary'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { WidgetDefinition } from './widget-contract'
import type { WidgetInstance } from './schema'

const FALLBACK = "This widget couldn't be displayed."

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  // React and the boundary both report a caught error on the console; the
  // assertions below read the boundary's report, and the rest is noise.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  consoleError.mockRestore()
})

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new TypeError("Cannot read properties of undefined (reading 'indexOf')")
  return <p>tile content</p>
}

function Page({ resetKey, explode }: { resetKey: string; explode: boolean }): ReactNode {
  return (
    <I18nProvider>
      <p>sibling tile</p>
      <WidgetErrorBoundary resetKey={resetKey} widgetId="stat-sales-orders" widgetType="chart">
        <Bomb explode={explode} />
      </WidgetErrorBoundary>
    </I18nProvider>
  )
}

describe('WidgetErrorBoundary', () => {
  it('renders the widget when nothing throws', () => {
    render(<Page resetKey="a" explode={false} />)
    expect(screen.getByText('tile content')).toBeTruthy()
    expect(screen.queryByText(FALLBACK)).toBeNull()
  })

  it('confines a render failure to its own tile', () => {
    render(<Page resetKey="a" explode />)
    expect(screen.getByText(FALLBACK)).toBeTruthy()
    expect(screen.getByText('sibling tile')).toBeTruthy()
  })

  // Contained, not swallowed: someone debugging a blank tile needs the error
  // AND which tile it came from.
  it('reports the failure on the console, naming the widget', () => {
    render(<Page resetKey="a" explode />)
    const report = consoleError.mock.calls.find((args: unknown[]) => String(args[0]).includes('stat-sales-orders'))
    expect(report).toBeTruthy()
    expect(String(report![0])).toContain('(chart)')
    expect(report![1]).toBeInstanceOf(TypeError)
  })

  // A builder author fixing a broken config must not have to reload.
  it('retries once the reset key changes', () => {
    const { rerender } = render(<Page resetKey="a" explode />)
    rerender(<Page resetKey="b" explode={false} />)
    expect(screen.getByText('tile content')).toBeTruthy()
    expect(screen.queryByText(FALLBACK)).toBeNull()
  })

  // Re-rendering for an unrelated reason is not a reason to run the failing
  // render again.
  it('stays failed while the reset key is unchanged', () => {
    const { rerender } = render(<Page resetKey="a" explode />)
    rerender(<Page resetKey="a" explode={false} />)
    expect(screen.getByText(FALLBACK)).toBeTruthy()
  })
})

describe('WidgetBody', () => {
  const instance: WidgetInstance = { id: 'w1', type: 'broken', layout: { x: 0, y: 0, w: 2, h: 2 }, chrome: 'card', config: {} }

  // The placement trap: parsed as a prop in the tile's own render, a throwing
  // parseConfig would escape the boundary that tile puts around the widget.
  it('parses the config inside the boundary, so a throwing parse is contained', () => {
    const def = {
      type: 'broken',
      parseConfig: () => { throw new Error('unparseable config') },
      Renderer: () => <p>never rendered</p>,
    } as unknown as WidgetDefinition

    render(
      <I18nProvider>
        <WidgetErrorBoundary resetKey="k" widgetId="w1" widgetType="broken">
          <WidgetBody def={def} instance={instance} clientId="c1" appId="a1" mode="runtime" />
        </WidgetErrorBoundary>
      </I18nProvider>,
    )
    expect(screen.getByText(FALLBACK)).toBeTruthy()
  })

  it('hands the Renderer the parsed config and every other prop', () => {
    const Renderer = vi.fn((props: { config: unknown; mode: string }) => <p>{`${JSON.stringify(props.config)} ${props.mode}`}</p>)
    const def = { type: 'ok', parseConfig: () => ({ parsed: true }), Renderer } as unknown as WidgetDefinition

    render(<WidgetBody def={def} instance={instance} clientId="c1" appId="a1" mode="builder" />)
    expect(screen.getByText('{"parsed":true} builder')).toBeTruthy()
  })
})
