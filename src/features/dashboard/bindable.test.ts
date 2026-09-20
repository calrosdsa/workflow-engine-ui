// The invariant widget-contract.ts states but cannot enforce: the widgets
// that DECLARE themselves bindable must be exactly the widgets whose
// Renderer READS parameterFilter.
//
// Declare without reading and the parameters panel offers a binding the
// runtime silently ignores. Read without declaring and a working binding is
// unreachable from the builder. Neither shows up as a failure anywhere —
// the chart just quietly does not narrow — which is the §2.6 silent-failure
// class this whole track exists to close.
//
// The two facts live in different files (widgets/<type>/index.ts and
// widgets/<type>/Renderer.tsx), so nothing but a test holds them together.
// Reading the Renderer source is crude, and deliberately so: it is the only
// way to observe "consumes this prop" without rendering every widget
// against a live query client.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import './widgets'
import { allWidgets } from './widget-registry'

const WIDGETS_DIR = join(__dirname, 'widgets')

function readsParameterFilter(type: string): boolean {
  const renderer = join(WIDGETS_DIR, type, 'Renderer.tsx')
  if (!existsSync(renderer)) return false
  return readFileSync(renderer, 'utf8').includes('parameterFilter')
}

describe('bindable widgets and parameterFilter readers are the same set', () => {
  const registered = allWidgets().map((w) => w.type)

  it('finds the widget folders it is meant to be checking', () => {
    // Guards against the whole suite passing vacuously if the folder layout
    // changes and every lookup starts returning false.
    expect(registered.length).toBeGreaterThan(1)
    expect(readdirSync(WIDGETS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).length)
      .toBeGreaterThanOrEqual(registered.length)
  })

  it('every widget declaring bindable reads the prop it would receive', () => {
    for (const w of allWidgets()) {
      if (!w.bindable) continue
      expect(readsParameterFilter(w.type), `${w.type} declares bindable but its Renderer never reads parameterFilter`).toBe(true)
    }
  })

  it('every widget reading the prop declares itself bindable', () => {
    for (const w of allWidgets()) {
      if (!readsParameterFilter(w.type)) continue
      expect(w.bindable, `${w.type} reads parameterFilter but is not declared bindable, so no one can bind to it`).toBeTruthy()
    }
  })

  // A tripwire rather than a rule: adding a third data widget should be a
  // deliberate act that updates this line, not something that slips in.
  it('is chart and table today', () => {
    expect(allWidgets().filter((w) => w.bindable).map((w) => w.type).sort()).toEqual(['chart', 'table'])
  })

  it('answers with the form its config names, and with nothing when it has none', () => {
    const chart = allWidgets().find((w) => w.type === 'chart')!
    expect(chart.bindable!.formId({ formId: 'invoices' } as never)).toBe('invoices')
    expect(chart.bindable!.formId({ formId: '' } as never)).toBeUndefined()
  })
})
