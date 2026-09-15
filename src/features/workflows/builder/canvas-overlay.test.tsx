// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CanvasOverlayContext, CanvasOverlayPortal } from './canvas-overlay'

afterEach(cleanup)

describe('CanvasOverlayPortal', () => {
  it('mounts its children into the provided canvas-column layer, not in place', () => {
    const layer = document.createElement('div')
    document.body.appendChild(layer)
    const { container } = render(
      <CanvasOverlayContext.Provider value={layer}>
        <div data-testid="canvas">
          <CanvasOverlayPortal><div data-testid="picker">picker</div></CanvasOverlayPortal>
        </div>
      </CanvasOverlayContext.Provider>,
    )

    expect(layer.querySelector('[data-testid="picker"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="canvas"] [data-testid="picker"]')).toBeNull()
    layer.remove()
  })

  it('renders in place when no layer is provided (any other FlowLayout host)', () => {
    const { container } = render(
      <div data-testid="canvas">
        <CanvasOverlayPortal><div data-testid="picker">picker</div></CanvasOverlayPortal>
      </div>,
    )

    expect(container.querySelector('[data-testid="canvas"] [data-testid="picker"]')).not.toBeNull()
  })
})
