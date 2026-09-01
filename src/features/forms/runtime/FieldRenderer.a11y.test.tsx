// @vitest-environment jsdom
//
// Every runtime form control must have an accessible name.
//
// Before this, FieldRenderer drew a bare `<label>` with no `htmlFor` next to an
// input with no `id`, so nothing connected the two: a screen reader announced
// "edit text, blank" for every field on every form in the product, clicking a
// label didn't focus its input, and help text and validation errors were
// visual-only. The assertions here are all "can this control be found BY ITS
// LABEL", which is exactly the thing that was missing.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import type { FieldDef } from '@/features/forms/types'
import type { FormSchema } from '@/features/form-builder/schema'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

afterEach(cleanup)

function schemaOf(fields: FieldDef[]): FormSchema {
  return resolveFormSchema({ layout: null, fields })
}

describe('accessible names', () => {
  it('names a text input by its label', () => {
    render(
      <FormRenderer
        schema={schemaOf([{ name: 'customer', label: 'Customer', type: 'string' }])}
        fields={[{ name: 'customer', label: 'Customer', type: 'string' }]}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByRole('textbox', { name: /customer/i })).toBeTruthy()
  })

  it('names controls across the field types that render one focusable element', () => {
    const fields: FieldDef[] = [
      { name: 'title', label: 'Title', type: 'string' },
      { name: 'notes', label: 'Notes', type: 'text' },
      { name: 'qty', label: 'Quantity', type: 'integer' },
      { name: 'active', label: 'Active', type: 'boolean' },
      { name: 'stage', label: 'Stage', type: 'enum', enum_values: ['new', 'won'] },
    ]
    render(<FormRenderer schema={schemaOf(fields)} fields={fields} onSubmit={() => {}} />)

    expect(screen.getByRole('textbox', { name: /^title$/i })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /notes/i })).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: /quantity/i })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /active/i })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /stage/i })).toBeTruthy()
  })

  it('focuses the input when its label is clicked', () => {
    const fields: FieldDef[] = [{ name: 'customer', label: 'Customer', type: 'string' }]
    const { container } = render(
      <FormRenderer schema={schemaOf(fields)} fields={fields} onSubmit={() => {}} />,
    )

    // The htmlFor/id pair is what makes this work; without it the label points
    // at nothing and the click is inert.
    const label = container.querySelector('label')!
    const input = screen.getByRole('textbox', { name: /customer/i })
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'))
    expect(input.getAttribute('id')).toBeTruthy()
  })

  it('gives two instances of the same form distinct ids', () => {
    // useId, not the field key: the key is unique within a schema, but a form
    // rendered twice on one page (a dialog over a page, say) would otherwise
    // emit duplicate ids and every label would point at the first copy.
    const fields: FieldDef[] = [{ name: 'customer', label: 'Customer', type: 'string' }]
    render(
      <>
        <FormRenderer schema={schemaOf(fields)} fields={fields} onSubmit={() => {}} />
        <FormRenderer schema={schemaOf(fields)} fields={fields} onSubmit={() => {}} />
      </>,
    )

    const [a, b] = screen.getAllByRole('textbox', { name: /customer/i })
    expect(a.getAttribute('id')).toBeTruthy()
    expect(a.getAttribute('id')).not.toBe(b.getAttribute('id'))
  })

  it('announces help text with the field', () => {
    const fields: FieldDef[] = [{ name: 'customer', label: 'Customer', type: 'string' }]
    const schema = schemaOf(fields)
    schema.sections[0].columns[0].elements[0].helpText = 'Legal entity name'

    render(<FormRenderer schema={schema} fields={fields} onSubmit={() => {}} />)

    const input = screen.getByRole('textbox', { name: /customer/i })
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // getElementById, not querySelector: useId() produces ids containing ':',
    // which needs CSS escaping in a selector (and CSS.escape isn't in jsdom).
    expect(document.getElementById(describedBy!)?.textContent).toContain('Legal entity name')
  })

  it('marks a required field as required for assistive tech', () => {
    const fields: FieldDef[] = [{ name: 'customer', label: 'Customer', type: 'string', required: true }]
    render(<FormRenderer schema={schemaOf(fields)} fields={fields} onSubmit={() => {}} />)

    expect(screen.getByRole('textbox', { name: /customer/i }).getAttribute('aria-required')).toBe('true')
  })

  it('hides the decorative required asterisk from the accessible name', () => {
    const fields: FieldDef[] = [{ name: 'customer', label: 'Customer', type: 'string', required: true }]
    render(<FormRenderer schema={schemaOf(fields)} fields={fields} onSubmit={() => {}} />)

    // "Customer", not "Customer *" — aria-required already carries that, and a
    // literal asterisk read aloud is noise.
    expect(screen.getByRole('textbox', { name: 'Customer' })).toBeTruthy()
  })
})

describe('multi-control fields are labelled as a group', () => {
  it('names a multiselect group rather than one of its checkboxes', () => {
    const fields: FieldDef[] = [
      { name: 'tags', label: 'Tags', type: 'json' },
    ]
    const schema = schemaOf(fields)
    const el = schema.sections[0].columns[0].elements[0]
    el.component = 'multiselect'
    el.options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]

    render(<FormRenderer schema={schema} fields={fields} onSubmit={() => {}} />)

    // A <label htmlFor> pointing at a container would be invalid and ignored,
    // so the set is named with role=group + aria-labelledby instead.
    expect(screen.getByRole('group', { name: /tags/i })).toBeTruthy()
  })
})
