// @vitest-environment jsdom
//
// Regression test for the "related" report block's child picker always
// showing "No Line Items children found": eligibleChildren used to filter
// useForms()'s own list by is_line_items, but ListForms (api/forms/
// handler.go) deliberately excludes every is_line_items row from that list
// -- so the filter could never match anything. The fix reads the PARENT
// form's own layout instead (resolveFormSchema + generatedLineItemsChildren),
// which is where a generated Line Items grid's childFormId actually lives.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { RelatedBlockConfigPanel } from './ConfigPanel'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { RelatedBlockConfig } from './schema'
import type { FormDefinition } from '@/features/forms/types'
import type { FormElement, FormSection } from '@/features/form-builder/schema'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

afterEach(cleanup)

function lineItemsElement(overrides: Partial<FormElement>): FormElement {
  return {
    id: 'el-line-items',
    key: 'lines',
    component: 'line_items',
    label: 'Order lines',
    validation: {},
    behavior: { visibility: 'always', required: 'optional', readOnly: 'editable' },
    appearance: { width: 'full' },
    binding: { source: 'none' },
    ...overrides,
  } as unknown as FormElement
}

function sectionsWith(el: FormElement): FormSection[] {
  return [
    {
      id: 'sec-1',
      title: 'Details',
      layout: '1',
      columns: [{ id: 'col-1', ratio: 1, elements: [el] }],
    },
  ] as unknown as FormSection[]
}

const parentWithGrid: FormDefinition = {
  id: 'parent-with-grid',
  name: 'Invoice',
  slug: 'invoice',
  fields: [],
  layout: { version: 1, sections: sectionsWith(lineItemsElement({ childFormId: 'child-1', label: 'Order lines' })) },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const parentWithoutGrid: FormDefinition = {
  id: 'parent-without-grid',
  name: 'Contact',
  slug: 'contact',
  fields: [],
  layout: { version: 1, sections: [] },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const childForm: FormDefinition = {
  id: 'child-1',
  name: 'Order lines (invoice)',
  slug: 'invoice_lines',
  fields: [{ name: 'sku', label: 'SKU', type: 'string' }],
  parent_form_id: 'parent-with-grid',
  is_line_items: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// GET /forms (ListForms) excludes is_line_items rows -- this list intentionally
// never contains `childForm`, matching real backend behavior.
const forms = [
  { id: 'parent-with-grid', name: 'Invoice', is_line_items: false },
  { id: 'parent-without-grid', name: 'Contact', is_line_items: false },
]

const formsById: Record<string, FormDefinition> = {
  'parent-with-grid': parentWithGrid,
  'parent-without-grid': parentWithoutGrid,
  'child-1': childForm,
}

vi.mock('@/features/forms/hooks', () => ({
  useForms: () => ({ data: forms, isLoading: false }),
  useForm: (id: string) => ({ data: formsById[id], isLoading: false }),
}))

// RelatedBlockConfigPanel calls useTranslation, which throws outside an
// I18nProvider ancestor — real provider, no props, same pattern as
// InsertDataMenu.test.tsx.
function renderPanel(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

function openChildPicker() {
  // Two comboboxes render once a parent is selected: "Parent form" then
  // "Line Items child" -- the second is the one under test.
  fireEvent.pointerDown(screen.getAllByRole('combobox')[1], { button: 0, pointerType: 'mouse' })
}

describe('RelatedBlockConfigPanel eligible children', () => {
  it('offers a generated Line Items grid found on the parent form layout', () => {
    const config: RelatedBlockConfig = { parent_form_id: 'parent-with-grid', child_form_id: '', columns: [] }
    renderPanel(<RelatedBlockConfigPanel config={config} onChange={() => {}} />)

    openChildPicker()

    expect(screen.queryByText('No Line Items children found on this form.')).toBeNull()
    expect(screen.getByRole('option', { name: 'Order lines' })).toBeTruthy()
  })

  it('selecting the option reports the real child form id back through onChange', () => {
    const config: RelatedBlockConfig = { parent_form_id: 'parent-with-grid', child_form_id: '', columns: [] }
    const onChange = vi.fn()
    renderPanel(<RelatedBlockConfigPanel config={config} onChange={onChange} />)

    openChildPicker()
    fireEvent.click(screen.getByRole('option', { name: 'Order lines' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ child_form_id: 'child-1' }))
  })

  it('still reports no children when the parent form has no Line Items grid', () => {
    const config: RelatedBlockConfig = { parent_form_id: 'parent-without-grid', child_form_id: '', columns: [] }
    renderPanel(<RelatedBlockConfigPanel config={config} onChange={() => {}} />)

    openChildPicker()

    expect(screen.getByText('No Line Items children found on this form.')).toBeTruthy()
  })
})
