import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncLineItemsChildren, generatedLineItemsChildren } from './lineItemsSync'
import { formsApi } from '@/features/forms/api'
import { emptySchema, emptyLineItemsConfig } from './schema'
import type { FormDefinition } from '@/features/forms/types'
import type { FormElement, LineItemSection } from './schema'

/** Wraps a single Line Items row field in the minimal section/column
 *  structure LineItemSection[] requires — mirrors what
 *  LineItemsColumnsEditor's addField would produce for one field alone in a
 *  1-column section. */
function lineItemSections(el: FormElement): LineItemSection[] {
  return [{ id: 's-li', title: 'Info', layout: '1', collapsed: false, columns: [{ id: 'c-li', ratio: 1, elements: [el] }] }]
}

vi.mock('@/features/forms/api', () => ({
  formsApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}))

function created(id: string): FormDefinition {
  return {
    id, name: 'x', slug: 'x', fields: [],
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

function lineItemsElement(overrides: Partial<FormElement> = {}): FormElement {
  return {
    id: 'el-1',
    component: 'line_items',
    label: 'Order Lines',
    key: 'order_lines',
    validation: {},
    behavior: { visibility: 'always', required: 'optional', readOnly: 'editable' },
    appearance: { width: 'full' },
    binding: { source: 'none' },
    lineItemColumns: [],
    lineItemConfig: emptyLineItemsConfig(),
    ...overrides,
  }
}

function schemaWith(el: FormElement) {
  const schema = emptySchema()
  schema.sections = [{
    id: 's1', title: 'Section', layout: '1', collapsed: false,
    columns: [{ id: 'c1', ratio: 1, elements: [el] }],
  }]
  return schema
}

describe('syncLineItemsChildren', () => {
  beforeEach(() => {
    vi.mocked(formsApi.create).mockReset()
    vi.mocked(formsApi.update).mockReset()
  })

  it('creates a child form for a top-level Line Items element', async () => {
    vi.mocked(formsApi.create).mockResolvedValue(created('child-1'))

    const { changed, schema } = await syncLineItemsChildren(schemaWith(lineItemsElement()), 'parent-id', 'orders')

    expect(changed).toBe(true)
    expect(formsApi.create).toHaveBeenCalledTimes(1)
    const [payload] = vi.mocked(formsApi.create).mock.calls[0]
    expect(payload.parent_form_id).toBe('parent-id')
    expect(payload.is_line_items).toBe(true)
    expect(payload.fields.some((f) => f.type === 'parent_link' && f.reference_table === 'parent-id')).toBe(true)

    const el = schema.sections[0].columns[0].elements[0]
    expect(el.childFormId).toBe('child-1')
    expect(el.key).toBe('orders_order_lines')
  })

  it('recurses into a nested line_items field, parenting it on the outer grid\'s own child form', async () => {
    vi.mocked(formsApi.create)
      .mockResolvedValueOnce(created('outer-child'))
      .mockResolvedValueOnce(created('inner-child'))

    const nestedField: FormElement = {
      id: 'el-2',
      component: 'line_items',
      label: 'Sub Lines',
      key: 'sub_lines',
      validation: {},
      behavior: { visibility: 'always', required: 'optional', readOnly: 'editable' },
      appearance: { width: 'full' },
      binding: { source: 'none' },
      lineItemColumns: [],
      lineItemConfig: emptyLineItemsConfig(),
    }
    const outer = lineItemsElement({ lineItemColumns: lineItemSections(nestedField) })

    const { schema } = await syncLineItemsChildren(schemaWith(outer), 'parent-id', 'orders')

    expect(formsApi.create).toHaveBeenCalledTimes(2)

    // Outer grid is parented on the top-level form.
    const [outerPayload] = vi.mocked(formsApi.create).mock.calls[0]
    expect(outerPayload.parent_form_id).toBe('parent-id')

    // Nested grid is parented on the OUTER grid's own child form, not on
    // the top-level parent — that's the whole point of nesting.
    const [innerPayload] = vi.mocked(formsApi.create).mock.calls[1]
    expect(innerPayload.parent_form_id).toBe('outer-child')

    const outerEl = schema.sections[0].columns[0].elements[0]
    expect(outerEl.childFormId).toBe('outer-child')
    expect(outerEl.lineItemColumns?.[0].columns[0].elements[0].childFormId).toBe('inner-child')
  })

  it('updates (not re-creates) a grid that already has a childFormId', async () => {
    vi.mocked(formsApi.update).mockResolvedValue(created('child-1'))

    const el = lineItemsElement({ key: 'orders_order_lines', childFormId: 'child-1' })
    await syncLineItemsChildren(schemaWith(el), 'parent-id', 'orders')

    expect(formsApi.update).toHaveBeenCalledTimes(1)
    expect(formsApi.create).not.toHaveBeenCalled()
    expect(vi.mocked(formsApi.update).mock.calls[0][0]).toBe('child-1')
  })
})

// generatedLineItemsChildren backs the "related" report block's child-form
// picker (reports/blocks/related/ConfigPanel.tsx): given a PARENT form's own
// resolved schema, which of its Line Items grids resolve to a real,
// already-synced child form id. useForms()'s own list can't answer this --
// ListForms (api/forms/handler.go) excludes every is_line_items row, so
// filtering that list can never find a match; this reads childFormId off
// the parent's own layout elements instead, same as the Line Item Count
// target-grid picker (form-builder/config/ConfigPanel.tsx) already does
// from the builder's own live schema.
describe('generatedLineItemsChildren', () => {
  it('includes a top-level generated grid that already has a childFormId', () => {
    const el = lineItemsElement({ childFormId: 'child-1', label: 'Order Lines' })
    const result = generatedLineItemsChildren(schemaWith(el))

    expect(result.map((e) => e.childFormId)).toEqual(['child-1'])
  })

  it('excludes a grid that has not been saved yet (no childFormId)', () => {
    const el = lineItemsElement() // no childFormId override
    const result = generatedLineItemsChildren(schemaWith(el))

    expect(result).toHaveLength(0)
  })

  it('excludes an adopted (sourceMode "existing") grid even if childFormId were somehow set', () => {
    const el = lineItemsElement({ sourceMode: 'existing', adoptedFormRef: 'other-form', childFormId: 'stale-id' })
    const result = generatedLineItemsChildren(schemaWith(el))

    expect(result).toHaveLength(0)
  })

  it('excludes a nested grid (inside another grid\'s row editor) -- top-level only, same scope as syncLineItemsChildren', () => {
    const nested = lineItemsElement({ id: 'el-nested', key: 'sub_lines', childFormId: 'nested-child' })
    const outer = lineItemsElement({ childFormId: 'outer-child', lineItemColumns: lineItemSections(nested) })
    const result = generatedLineItemsChildren(schemaWith(outer))

    expect(result.map((e) => e.childFormId)).toEqual(['outer-child'])
  })

  it('returns nothing for an empty schema', () => {
    expect(generatedLineItemsChildren(emptySchema())).toHaveLength(0)
  })
})
