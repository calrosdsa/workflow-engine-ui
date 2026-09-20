import { describe, it, expect } from 'vitest'
import {
  resolveParameterFilter, effectiveValue, activeParameterKeys,
  bindableWidgets, coerceOperator, createParameter, operatorsFor,
} from './parameters'
import type { DashboardParameter, ParameterBinding } from './schema'

const REGION: DashboardParameter = { key: 'region', label: 'Region', type: 'text' }
const MIN_TOTAL: DashboardParameter = { key: 'min_total', label: 'Minimum total', type: 'number' }
const PARAMS = [REGION, MIN_TOTAL]

const BINDINGS: ParameterBinding[] = [
  { parameterKey: 'region', widgetId: 'chart_1', field: 'region' },
  { parameterKey: 'min_total', widgetId: 'chart_1', field: 'grand_total', op: 'gte' },
  { parameterKey: 'region', widgetId: 'table_1', field: 'customer_region' },
]

describe('resolveParameterFilter', () => {
  it('builds one condition per bound parameter that has a value', () => {
    const g = resolveParameterFilter('chart_1', PARAMS, BINDINGS, { region: 'North', min_total: 500 })
    expect(g?.conditions).toHaveLength(2)
    expect(g?.combinator).toBe('and')
    expect(g?.conditions[0]).toMatchObject({ field: 'region', op: 'eq', value: 'North' })
    expect(g?.conditions[1]).toMatchObject({ field: 'grand_total', op: 'gte', value: 500 })
  })

  // The operator lives on the BINDING, lifted from the report model, so one
  // parameter can compare differently per tile.
  it('binds the same parameter to a different field on another tile', () => {
    const g = resolveParameterFilter('table_1', PARAMS, BINDINGS, { region: 'North' })
    expect(g?.conditions).toHaveLength(1)
    expect(g?.conditions[0]).toMatchObject({ field: 'customer_region', value: 'North' })
  })

  // The single most important behaviour: a dashboard must open showing
  // everything, not nothing.
  it('narrows nothing when no value is supplied', () => {
    expect(resolveParameterFilter('chart_1', PARAMS, BINDINGS, {})).toBeUndefined()
  })

  it('treats an empty string and null as unset, not as values to match', () => {
    expect(resolveParameterFilter('chart_1', PARAMS, BINDINGS, { region: '', min_total: null })).toBeUndefined()
  })

  it('applies a declared default when the viewer has supplied nothing', () => {
    const withDefault: DashboardParameter[] = [{ ...REGION, default: 'South' }]
    const g = resolveParameterFilter('chart_1', withDefault, BINDINGS, {})
    expect(g?.conditions[0]).toMatchObject({ field: 'region', value: 'South' })
  })

  it("lets a viewer's value override the default", () => {
    const withDefault: DashboardParameter[] = [{ ...REGION, default: 'South' }]
    const g = resolveParameterFilter('chart_1', withDefault, BINDINGS, { region: 'North' })
    expect(g?.conditions[0]).toMatchObject({ value: 'North' })
  })

  it('ignores bindings aimed at other tiles', () => {
    const g = resolveParameterFilter('chart_1', PARAMS, BINDINGS, { region: 'North' })
    expect(g?.conditions.every((c) => c.field !== 'customer_region')).toBe(true)
  })

  // Dashboards outlive the parameters they were authored against. A stale
  // binding must lose the binding, not the tile.
  it('skips a binding whose parameter no longer exists', () => {
    const stale: ParameterBinding[] = [{ parameterKey: 'deleted', widgetId: 'chart_1', field: 'x' }]
    expect(resolveParameterFilter('chart_1', PARAMS, stale, { deleted: 'v' })).toBeUndefined()
  })

  it('returns undefined when the dashboard declares no parameters at all', () => {
    expect(resolveParameterFilter('chart_1', undefined, undefined, {})).toBeUndefined()
    expect(resolveParameterFilter('chart_1', PARAMS, undefined, { region: 'North' })).toBeUndefined()
  })

  // The condition id feeds a react-query cache key upstream; a random one
  // would invalidate the tile's data on every render.
  it('produces a stable condition id for the same binding', () => {
    const once = resolveParameterFilter('chart_1', PARAMS, BINDINGS, { region: 'North' })
    const twice = resolveParameterFilter('chart_1', PARAMS, BINDINGS, { region: 'North' })
    expect(once).toEqual(twice)
  })

  it('treats false as a real value rather than as unset', () => {
    const flag: DashboardParameter[] = [{ key: 'archived', label: 'Archived', type: 'boolean' }]
    const bind: ParameterBinding[] = [{ parameterKey: 'archived', widgetId: 'chart_1', field: 'is_archived' }]
    const g = resolveParameterFilter('chart_1', flag, bind, { archived: false })
    expect(g?.conditions[0]).toMatchObject({ field: 'is_archived', value: false })
  })
})

describe('effectiveValue and activeParameterKeys', () => {
  it('reports which parameters are currently narrowing', () => {
    expect(activeParameterKeys(PARAMS, { region: 'North' })).toEqual(['region'])
    expect(activeParameterKeys(PARAMS, {})).toEqual([])
    expect(activeParameterKeys([{ ...REGION, default: 'South' }], {})).toEqual(['region'])
  })

  it('prefers a supplied value over a default', () => {
    expect(effectiveValue({ ...REGION, default: 'South' }, { region: 'North' })).toBe('North')
    expect(effectiveValue({ ...REGION, default: 'South' }, {})).toBe('South')
  })
})

describe('authoring helpers', () => {
  // Asks the registry rather than reading config.formId, because `config`
  // is opaque to the dashboard core by contract.
  const lookup = (type: string) => ({
    chart: { bindable: { formId: (c: never) => (c as { formId?: string }).formId || undefined } },
    heading: {},
  }[type] as { bindable?: { formId: (c: never) => string | undefined } } | undefined)

  const tiles = [
    { id: 'w1', type: 'chart', title: 'Revenue', config: { formId: 'invoices' } },
    { id: 'w2', type: 'chart', title: '  ', config: { formId: 'invoices' } },
    { id: 'w3', type: 'chart', config: { formId: '' } },
    { id: 'w4', type: 'heading', title: 'Hi', config: { formId: 'invoices' } },
    { id: 'w5', type: 'unregistered', title: 'X', config: { formId: 'invoices' } },
  ]

  it('offers only widgets that declared themselves bindable and have a form', () => {
    expect(bindableWidgets(tiles, lookup).map((w) => w.id)).toEqual(['w1', 'w2'])
  })

  // A heading carrying a formId in its config is still not a target — the
  // declaration is what counts, not the shape of the blob.
  it('ignores a formId on a widget type that never declared bindable', () => {
    expect(bindableWidgets(tiles, lookup).some((w) => w.id === 'w4')).toBe(false)
  })

  it('falls back to the widget type when the tile has no usable title', () => {
    const out = bindableWidgets(tiles, lookup)
    expect(out.find((w) => w.id === 'w1')?.label).toBe('Revenue')
    expect(out.find((w) => w.id === 'w2')?.label).toBe('chart')
  })

  it('creates a key that does not collide with an existing one', () => {
    expect(createParameter(undefined).key).toBe('param_1')
    expect(createParameter([{ key: 'param_1', label: 'x', type: 'text' }]).key).toBe('param_2')
    const taken = [
      { key: 'param_1', label: 'x', type: 'text' as const },
      { key: 'param_2', label: 'x', type: 'text' as const },
    ]
    expect(taken.map((p) => p.key)).not.toContain(createParameter(taken).key)
  })

  it('offers ordering operators only where the type has an order', () => {
    expect(operatorsFor('number')).toContain('gte')
    expect(operatorsFor('date')).toContain('lte')
    expect(operatorsFor('text')).not.toContain('gte')
    expect(operatorsFor('boolean')).toEqual(['eq', 'neq'])
  })

  // A `contains` left behind on a date parameter would compile to a text
  // comparison against a date column.
  it('coerces an operator that no longer suits the type', () => {
    expect(coerceOperator('contains', 'text')).toBe('contains')
    expect(coerceOperator('contains', 'date')).toBe('eq')
    expect(coerceOperator(undefined, 'number')).toBe('eq')
    expect(coerceOperator('gte', 'number')).toBe('gte')
  })
})
