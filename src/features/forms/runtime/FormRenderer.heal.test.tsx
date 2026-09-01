// @vitest-environment jsdom
//
// End-to-end render proof for heal-on-load (form-builder/heal.ts): a form
// created through the API — real backend fields, NO layout blob — must
// render actual inputs, because every runtime surface draws from the layout
// alone. Before healing this exact setup produced an empty <form> whose
// submit sent {} and 422'd on the first required field: "real columns in
// Postgres, nothing to see or edit". This test IS that scenario, minus the
// network: resolveFormSchema over a layoutless definition, straight into the
// real FormRenderer.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { FormRenderer } from './FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import type { FieldDef } from '@/features/forms/types'

// jsdom has no ResizeObserver; Radix's Select mounts one. Same stub every
// RTL suite that renders Radix needs.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

afterEach(cleanup)

const apiCreatedForm: { layout: null; fields: FieldDef[] } = {
  layout: null, // exactly what create_form over the MCP/API produces
  fields: [
    { name: 'title', label: 'Bug Title', type: 'string', required: true },
    { name: 'details', label: 'Repro Steps', type: 'text' },
    { name: 'severity', label: 'Severity', type: 'enum', enum_values: ['low', 'high'] },
    { name: 'resolved', label: 'Resolved', type: 'boolean' },
  ],
}

describe('FormRenderer over a healed, API-created form', () => {
  it('renders an input for every backend field instead of an empty form', () => {
    const schema = resolveFormSchema(apiCreatedForm)

    render(
      <FormRenderer
        schema={schema}
        fields={apiCreatedForm.fields}
        onSubmit={() => {}}
      />,
    )

    // Every field's label is on screen — the "nothing to see" bug is dead.
    expect(screen.getByText('Bug Title')).toBeTruthy()
    expect(screen.getByText('Repro Steps')).toBeTruthy()
    expect(screen.getByText('Severity')).toBeTruthy()
    expect(screen.getByText('Resolved')).toBeTruthy()

    // And they are real, fillable controls, not just labels.
    const textboxes = screen.getAllByRole('textbox')
    expect(textboxes.length).toBeGreaterThanOrEqual(2) // title input + details textarea
    expect(screen.getByRole('checkbox')).toBeTruthy() // resolved
  })
})
