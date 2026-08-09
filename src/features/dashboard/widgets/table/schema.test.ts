import { describe, it, expect } from 'vitest'
import { parseTableConfig, createDefaultTableConfig } from './schema'

describe('parseTableConfig', () => {
  it('round-trips a fully-specified config', () => {
    const full = {
      formId: 'f1',
      columns: ['name', 'status'],
      defaultFilter: { id: 'g1', combinator: 'and' as const, conditions: [], groups: [] },
      defaultSort: [{ id: 's1', field: 'name', dir: 'asc' as const }],
      pageSize: 20,
      allowUserFilter: true,
      rowClick: 'none' as const,
    }
    expect(parseTableConfig(full)).toEqual(full)
  })

  it('falls back to defaults when formId is missing', () => {
    expect(parseTableConfig({})).toEqual(createDefaultTableConfig())
    expect(parseTableConfig(null)).toEqual(createDefaultTableConfig())
    expect(parseTableConfig('garbage')).toEqual(createDefaultTableConfig())
  })

  it('heals a non-array columns field to an empty array', () => {
    const parsed = parseTableConfig({ formId: 'f1', columns: 'not-an-array' })
    expect(parsed.columns).toEqual([])
  })

  it('filters out non-string entries from columns', () => {
    const parsed = parseTableConfig({ formId: 'f1', columns: ['ok', 42, null, 'also-ok'] })
    expect(parsed.columns).toEqual(['ok', 'also-ok'])
  })

  it('heals an invalid pageSize to the 10-row default', () => {
    expect(parseTableConfig({ formId: 'f1', pageSize: -5 }).pageSize).toBe(10)
    expect(parseTableConfig({ formId: 'f1', pageSize: '20' }).pageSize).toBe(10)
    expect(parseTableConfig({ formId: 'f1', pageSize: 0 }).pageSize).toBe(10)
  })

  it('heals an invalid rowClick to "record"', () => {
    expect(parseTableConfig({ formId: 'f1', rowClick: 'bogus' }).rowClick).toBe('record')
  })

  it('coerces allowUserFilter to a strict boolean', () => {
    expect(parseTableConfig({ formId: 'f1', allowUserFilter: 'true' }).allowUserFilter).toBe(false)
    expect(parseTableConfig({ formId: 'f1', allowUserFilter: true }).allowUserFilter).toBe(true)
  })

  it('createDefaultTableConfig produces an empty-formId config with sane defaults', () => {
    expect(createDefaultTableConfig()).toEqual({
      formId: '', columns: [], pageSize: 10, allowUserFilter: false, rowClick: 'record',
    })
  })
})
