import { describe, it, expect, afterEach } from 'vitest'
import { LayoutTemplate } from 'lucide-react'
import { createWidget, duplicateWidget } from './factory'
import { registerWidget, resetRegistry } from './widget-registry'
import type { WidgetDefinition } from './widget-contract'
import type { WidgetInstance } from './schema'

function fakeWidget(type: string): WidgetDefinition<{ note: string }> {
  return {
    type,
    label: type,
    icon: LayoutTemplate,
    category: 'Content',
    description: 'fake',
    parseConfig: (raw) => (raw && typeof raw === 'object' ? (raw as { note: string }) : { note: '' }),
    createDefaultConfig: () => ({ note: 'default' }),
    defaultLayout: { w: 4, h: 3, minW: 2, minH: 2 },
    defaultChrome: 'card',
    Renderer: () => null,
    ConfigPanel: () => null,
  }
}

afterEach(() => {
  resetRegistry()
})

describe('createWidget', () => {
  it('creates an instance seeded from the registry defaults', () => {
    registerWidget(fakeWidget('fake'))
    const inst = createWidget('fake', [])
    expect(inst.type).toBe('fake')
    expect(inst.chrome).toBe('card')
    expect(inst.config).toEqual({ note: 'default' })
    expect(inst.layout).toEqual({ x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 })
  })

  it('stacks a new widget below existing ones', () => {
    registerWidget(fakeWidget('fake'))
    const first = createWidget('fake', [])
    const existing: WidgetInstance[] = [first]
    const second = createWidget('fake', existing)
    expect(second.layout.y).toBe(first.layout.y + first.layout.h)
    expect(second.layout.x).toBe(0)
  })

  it('assigns unique ids across creations', () => {
    registerWidget(fakeWidget('fake'))
    const a = createWidget('fake', [])
    const b = createWidget('fake', [a])
    expect(a.id).not.toBe(b.id)
  })

  it('throws for an unregistered type rather than silently creating a broken instance', () => {
    expect(() => createWidget('nonexistent', [])).toThrow(/not registered/)
  })
})

describe('duplicateWidget', () => {
  it('deep-clones with a fresh id, offset one row down', () => {
    const original: WidgetInstance = {
      id: 'orig',
      type: 'fake',
      layout: { x: 0, y: 0, w: 4, h: 3 },
      chrome: 'card',
      config: { nested: { note: 'hi' } },
    }
    const copy = duplicateWidget(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.layout).toEqual({ x: 0, y: 3, w: 4, h: 3 })
    expect(copy.config).toEqual(original.config)
    expect(copy.config).not.toBe(original.config) // deep clone, not shared reference
  })
})
