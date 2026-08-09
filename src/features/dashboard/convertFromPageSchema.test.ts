import { describe, it, expect } from 'vitest'
import { pageSchemaToDashboard } from './convertFromPageSchema'
import type { PageSchema, PageSection, PageComponent } from '@/features/page-builder/schema'

function component(overrides: Partial<PageComponent> & Pick<PageComponent, 'component'>): PageComponent {
  return { id: `c-${Math.random()}`, ...overrides }
}

function section(overrides: Partial<PageSection> & Pick<PageSection, 'columns'>): PageSection {
  return { id: `s-${Math.random()}`, title: 'Section', layout: '1', ...overrides }
}

describe('pageSchemaToDashboard', () => {
  it('produces an empty dashboard for an empty page', () => {
    const schema: PageSchema = { version: 1, sections: [] }
    const dashboard = pageSchemaToDashboard(schema)
    expect(dashboard.widgets).toEqual([])
    expect(dashboard.settings.cols).toBe(12)
  })

  it('maps a single-column section to full-width (w=12) widgets stacked by height', () => {
    const schema: PageSchema = {
      version: 1,
      sections: [
        section({
          layout: '1',
          columns: [{
            id: 'col1',
            ratio: 1,
            components: [
              component({ component: 'heading', text: 'Title', level: 1 }),
              component({ component: 'paragraph', text: 'Body text' }),
            ],
          }],
        }),
      ],
    }
    const dashboard = pageSchemaToDashboard(schema)
    expect(dashboard.widgets).toHaveLength(2)
    const [heading, paragraph] = dashboard.widgets
    expect(heading.type).toBe('heading')
    expect(heading.layout.x).toBe(0)
    expect(heading.layout.w).toBe(12)
    expect(heading.config).toEqual({ text: 'Title', level: 1 })

    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.layout.x).toBe(0)
    expect(paragraph.layout.w).toBe(12)
    // Stacked below the heading, not overlapping it.
    expect(paragraph.layout.y).toBe(heading.layout.y + heading.layout.h)
  })

  it('splits column spans proportionally across a 2-column 30/70 layout, summing to 12', () => {
    const schema: PageSchema = {
      version: 1,
      sections: [
        section({
          layout: '2-30-70',
          columns: [
            { id: 'left', ratio: 3, components: [component({ component: 'paragraph', text: 'left' })] },
            { id: 'right', ratio: 7, components: [component({ component: 'paragraph', text: 'right' })] },
          ],
        }),
      ],
    }
    const dashboard = pageSchemaToDashboard(schema)
    const [left, right] = dashboard.widgets
    expect(left.layout.x).toBe(0)
    expect(right.layout.x).toBe(left.layout.w)
    expect(left.layout.w + right.layout.w).toBe(12)
    // 30/70 of 12 -> 3.6/8.4 -> rounds to 4/8 (largest-remainder makes the
    // bigger fractional part win the extra unit).
    expect([left.layout.w, right.layout.w]).toEqual([4, 8])
  })

  it('places a later section below all widgets from an earlier section', () => {
    const schema: PageSchema = {
      version: 1,
      sections: [
        section({ columns: [{ id: 'c1', ratio: 1, components: [component({ component: 'image', height: undefined })] }] }),
        section({ columns: [{ id: 'c2', ratio: 1, components: [component({ component: 'button', label: 'Go' })] }] }),
      ],
    }
    const dashboard = pageSchemaToDashboard(schema)
    const [imageWidget, buttonWidget] = dashboard.widgets
    expect(buttonWidget.layout.y).toBeGreaterThanOrEqual(imageWidget.layout.y + imageWidget.layout.h)
  })

  it('maps button config fields (linkType/menuSlug/url/variant) through unchanged', () => {
    const schema: PageSchema = {
      version: 1,
      sections: [
        section({
          columns: [{
            id: 'c1',
            ratio: 1,
            components: [component({ component: 'button', label: 'Visit', linkType: 'external', url: 'https://example.com', variant: 'outline' })],
          }],
        }),
      ],
    }
    const [btn] = pageSchemaToDashboard(schema).widgets
    expect(btn.config).toEqual({ label: 'Visit', linkType: 'external', menuSlug: undefined, url: 'https://example.com', variant: 'outline' })
  })

  it('gives every widget a unique id and sets chrome to "plain"', () => {
    const schema: PageSchema = {
      version: 1,
      sections: [
        section({
          columns: [{
            id: 'c1', ratio: 1,
            components: [component({ component: 'divider' }), component({ component: 'divider' })],
          }],
        }),
      ],
    }
    const dashboard = pageSchemaToDashboard(schema)
    expect(dashboard.widgets[0].id).not.toBe(dashboard.widgets[1].id)
    expect(dashboard.widgets.every((w) => w.chrome === 'plain')).toBe(true)
  })
})
