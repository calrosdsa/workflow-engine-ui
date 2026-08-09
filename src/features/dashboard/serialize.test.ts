import { describe, it, expect } from 'vitest'
import { parseDashboardSchema } from './serialize'
import { emptyDashboardSchema, DEFAULT_DASHBOARD_SETTINGS, type DashboardSchema } from './schema'

describe('parseDashboardSchema', () => {
  it('returns an empty schema for null/undefined/empty-string input', () => {
    expect(parseDashboardSchema(null)).toEqual(emptyDashboardSchema())
    expect(parseDashboardSchema(undefined)).toEqual(emptyDashboardSchema())
    expect(parseDashboardSchema('')).toEqual(emptyDashboardSchema())
  })

  it('returns an empty schema for garbage/legacy shapes ({}) without throwing', () => {
    expect(parseDashboardSchema({})).toEqual(emptyDashboardSchema())
    expect(parseDashboardSchema('not json{')).toEqual(emptyDashboardSchema())
    expect(parseDashboardSchema(42)).toEqual(emptyDashboardSchema())
  })

  it('round-trips a well-formed schema, including a widget of an unregistered type', () => {
    const schema: DashboardSchema = {
      version: 1,
      settings: { ...DEFAULT_DASHBOARD_SETTINGS, maxWidth: 1200 },
      widgets: [
        { id: 'w1', type: 'chart', layout: { x: 0, y: 0, w: 6, h: 6 }, chrome: 'card', config: { formId: 'f1' } },
        // A widget whose plugin was since removed/renamed — must survive
        // parsing untouched so re-saving the dashboard doesn't drop it.
        { id: 'w2', type: 'no-longer-registered', layout: { x: 6, y: 0, w: 6, h: 6 }, chrome: 'plain', config: { anything: true } },
      ],
    }
    expect(parseDashboardSchema(schema)).toEqual(schema)
  })

  it('parses a JSON string exactly like an already-parsed object', () => {
    const schema = emptyDashboardSchema()
    schema.widgets.push({ id: 'w1', type: 'quick-links', layout: { x: 0, y: 0, w: 4, h: 4 }, chrome: 'card', config: {} })
    expect(parseDashboardSchema(JSON.stringify(schema))).toEqual(schema)
  })

  it('drops widget entries missing required fields (id/type/layout) rather than crashing', () => {
    const raw = {
      version: 1,
      settings: DEFAULT_DASHBOARD_SETTINGS,
      widgets: [
        { id: 'ok', type: 'chart', layout: { x: 0, y: 0, w: 4, h: 4 }, chrome: 'card', config: {} },
        { id: 'missing-layout', type: 'chart', chrome: 'card', config: {} },
        { type: 'missing-id', layout: { x: 0, y: 0, w: 4, h: 4 } },
        'not-even-an-object',
      ],
    }
    const parsed = parseDashboardSchema(raw)
    expect(parsed.widgets.map((w) => w.id)).toEqual(['ok'])
  })

  it('fills in missing settings fields with defaults', () => {
    const parsed = parseDashboardSchema({ widgets: [] })
    expect(parsed.settings).toEqual(DEFAULT_DASHBOARD_SETTINGS)
  })
})
