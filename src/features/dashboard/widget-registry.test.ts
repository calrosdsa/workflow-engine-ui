import { describe, it, expect, afterEach } from 'vitest'
import { registerWidget, getWidget, allWidgets, widgetsByCategory, resetRegistry } from './widget-registry'
import type { WidgetDefinition } from './widget-contract'
import { LayoutTemplate } from 'lucide-react'

function fakeWidget(type: string, category: WidgetDefinition['category'] = 'Content'): WidgetDefinition<{ note: string }> {
  return {
    type,
    label: type,
    icon: LayoutTemplate,
    category,
    description: 'a fake widget for tests',
    parseConfig: (raw) => (raw && typeof raw === 'object' ? (raw as { note: string }) : { note: '' }),
    createDefaultConfig: () => ({ note: '' }),
    defaultLayout: { w: 4, h: 4 },
    defaultChrome: 'card',
    Renderer: () => null,
    ConfigPanel: () => null,
  }
}

afterEach(() => {
  resetRegistry()
})

describe('widget-registry', () => {
  it('registers and looks up a widget by type', () => {
    registerWidget(fakeWidget('fake-a'))
    expect(getWidget('fake-a')?.type).toBe('fake-a')
  })

  it('returns undefined for an unregistered type', () => {
    expect(getWidget('does-not-exist')).toBeUndefined()
  })

  it('throws on duplicate registration', () => {
    registerWidget(fakeWidget('fake-a'))
    expect(() => registerWidget(fakeWidget('fake-a'))).toThrow(/already registered/)
  })

  it('filters by category', () => {
    registerWidget(fakeWidget('fake-content', 'Content'))
    registerWidget(fakeWidget('fake-data', 'Data'))
    expect(widgetsByCategory('Content').map((w) => w.type)).toEqual(['fake-content'])
    expect(widgetsByCategory('Data').map((w) => w.type)).toEqual(['fake-data'])
  })

  it('allWidgets reflects every registration', () => {
    registerWidget(fakeWidget('fake-a'))
    registerWidget(fakeWidget('fake-b'))
    expect(allWidgets().map((w) => w.type).sort()).toEqual(['fake-a', 'fake-b'])
  })
})
