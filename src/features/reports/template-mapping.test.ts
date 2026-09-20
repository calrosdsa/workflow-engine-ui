import { describe, expect, it } from 'vitest'
import { applyFormMapping, findFormPlaceholders } from './template-mapping'
import type { ReportDefinition } from './types'

function baseDefinition(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return {
    version: 1,
    name: 'Example',
    blocks: [],
    settings: {},
    visibility: { mode: 'public' },
    ...overrides,
  }
}

describe('findFormPlaceholders', () => {
  it('returns nothing for a definition with no form_id anywhere (e.g. Blank)', () => {
    expect(findFormPlaceholders(baseDefinition())).toEqual([])
  })

  it('finds a form_id nested inside a table block config, labeled by the block name', () => {
    const def = baseDefinition({
      blocks: [{
        id: 'charges', name: 'Charges', type: 'table',
        layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
        config: { form_id: 'your-invoice-lines-form-id', columns: [{ key: 'description', label: 'Description' }] },
      }],
    })
    expect(findFormPlaceholders(def)).toEqual([
      { value: 'your-invoice-lines-form-id', usedBy: ['Charges'] },
    ])
  })

  it('falls back to "type N" when a block has no name', () => {
    const def = baseDefinition({
      blocks: [{
        id: 'b1', type: 'group',
        layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
        config: { form_id: 'your-deals-form-id' },
      }],
    })
    expect(findFormPlaceholders(def)).toEqual([
      { value: 'your-deals-form-id', usedBy: ['group 1'] },
    ])
  })

  it('finds a form_id on a data source, labeled by its name', () => {
    const def = baseDefinition({
      data_sources: [{ id: 'src-charges', name: 'Charges', form_id: 'your-invoice-lines-form-id' }],
    })
    expect(findFormPlaceholders(def)).toEqual([
      { value: 'your-invoice-lines-form-id', usedBy: ['Charges'] },
    ])
  })

  it('merges usedBy when the SAME placeholder value is referenced from multiple places', () => {
    const def = baseDefinition({
      data_sources: [{ id: 'src-charges', name: 'Charges', form_id: 'your-invoice-lines-form-id' }],
      blocks: [{
        id: 'b1', name: 'Line items', type: 'table',
        layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
        config: { form_id: 'your-invoice-lines-form-id' },
      }],
    })
    expect(findFormPlaceholders(def)).toEqual([
      { value: 'your-invoice-lines-form-id', usedBy: ['Charges', 'Line items'] },
    ])
  })

  it('reports each of several DISTINCT placeholders separately, in first-seen order', () => {
    const def = baseDefinition({
      blocks: [
        {
          id: 'header', name: 'Customer', type: 'table',
          layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
          config: { form_id: 'your-customers-form-id' },
        },
        {
          id: 'lines', name: 'Charges', type: 'table',
          layout: { row: 1, col: 0, row_span: 1, col_span: 1 },
          config: { form_id: 'your-invoice-lines-form-id' },
        },
      ],
    })
    expect(findFormPlaceholders(def)).toEqual([
      { value: 'your-customers-form-id', usedBy: ['Customer'] },
      { value: 'your-invoice-lines-form-id', usedBy: ['Charges'] },
    ])
  })
})

describe('applyFormMapping', () => {
  it('replaces a block config form_id with the mapped real form id', () => {
    const def = baseDefinition({
      blocks: [{
        id: 'charges', name: 'Charges', type: 'table',
        layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
        config: { form_id: 'your-invoice-lines-form-id', columns: [{ key: 'description', label: 'Description' }] },
      }],
    })
    const mapped = applyFormMapping(def, { 'your-invoice-lines-form-id': 'real-form-abc' })
    expect(mapped.blocks[0].config).toEqual({
      form_id: 'real-form-abc',
      columns: [{ key: 'description', label: 'Description' }],
    })
  })

  it('replaces a data source form_id', () => {
    const def = baseDefinition({
      data_sources: [{ id: 'src-charges', name: 'Charges', form_id: 'your-invoice-lines-form-id' }],
    })
    const mapped = applyFormMapping(def, { 'your-invoice-lines-form-id': 'real-form-abc' })
    expect(mapped.data_sources![0].form_id).toBe('real-form-abc')
  })

  it('does not mutate the original definition (safe to reuse the cached example)', () => {
    const def = baseDefinition({
      blocks: [{
        id: 'charges', type: 'table',
        layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
        config: { form_id: 'your-invoice-lines-form-id' },
      }],
    })
    applyFormMapping(def, { 'your-invoice-lines-form-id': 'real-form-abc' })
    expect((def.blocks[0].config as { form_id: string }).form_id).toBe('your-invoice-lines-form-id')
  })

  it('leaves an unmapped placeholder untouched (defensive)', () => {
    const def = baseDefinition({
      blocks: [{
        id: 'charges', type: 'table',
        layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
        config: { form_id: 'your-invoice-lines-form-id' },
      }],
    })
    const mapped = applyFormMapping(def, {})
    expect((mapped.blocks[0].config as { form_id: string }).form_id).toBe('your-invoice-lines-form-id')
  })

  it('maps multiple distinct placeholders independently in one pass', () => {
    const def = baseDefinition({
      blocks: [
        {
          id: 'header', type: 'table',
          layout: { row: 0, col: 0, row_span: 1, col_span: 1 },
          config: { form_id: 'your-customers-form-id' },
        },
        {
          id: 'lines', type: 'table',
          layout: { row: 1, col: 0, row_span: 1, col_span: 1 },
          config: { form_id: 'your-invoice-lines-form-id' },
        },
      ],
    })
    const mapped = applyFormMapping(def, {
      'your-customers-form-id': 'real-customers',
      'your-invoice-lines-form-id': 'real-lines',
    })
    expect((mapped.blocks[0].config as { form_id: string }).form_id).toBe('real-customers')
    expect((mapped.blocks[1].config as { form_id: string }).form_id).toBe('real-lines')
  })
})
