// @vitest-environment jsdom
//
// Regression test for a blank field dropdown: a condition addressing a
// system column (id/created_at/updated_at) never had a matching option in
// the picker, because every caller's `fields` comes from a form's own
// FormDefinition.fields, which by design excludes those reserved names (see
// SYSTEM_FIELDS's doc comment in features/forms/types.ts). The underlying
// filter (e.g. an update_records node matching `id = <expr>`) already ran
// correctly — only the picker couldn't show what was selected.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { FilterBuilder, newGroup } from './FilterBuilder'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup } from '../types'

// FilterBuilder calls useTranslation, which throws outside an I18nProvider
// ancestor — real provider, no props, same as InsertDataMenu.test.tsx.
function renderBuilder(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

afterEach(cleanup)

const formFields: FieldDef[] = [{ name: 'status', label: 'Status', type: 'string' }]

function groupWithCondition(field: string): FilterGroup {
  const g = newGroup()
  g.conditions.push({ id: 'c1', field, op: 'eq', value_mode: 'static', value: 'x' })
  return g
}

describe('FilterBuilder field picker', () => {
  it('offers id/created_at/updated_at even though the target form never declares them', () => {
    renderBuilder(
      <FilterBuilder group={groupWithCondition('id')} fields={formFields} variables={[]} onChange={() => {}} />,
    )

    // Open the Field dropdown (the first SelectTrigger in the row).
    fireEvent.pointerDown(screen.getAllByRole('combobox')[0], { button: 0, pointerType: 'mouse' })

    expect(screen.getByRole('option', { name: 'ID' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Created At' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Last Modified' })).toBeTruthy()
    // The form's own field is still there alongside the system ones.
    expect(screen.getByRole('option', { name: 'Status' })).toBeTruthy()
  })

  it('shows the selected system field\'s label on the trigger, not a blank picker', () => {
    renderBuilder(
      <FilterBuilder group={groupWithCondition('id')} fields={formFields} variables={[]} onChange={() => {}} />,
    )
    // Reproduces the reported symptom directly: condition.field === 'id' is
    // already set (as it would be reading a saved workflow back), and
    // without ever opening the dropdown the trigger should already read
    // "ID" — a blank trigger here is exactly the bug.
    expect(screen.getAllByRole('combobox')[0].textContent).toBe('ID')
  })

  it('does not offer a stray duplicate when a real field happens to share a system field\'s name', () => {
    // Impossible for a real form field named "id"/"created_at"/"updated_at"
    // (RESERVED_FIELD_KEYS blocks it at save time), but a non-form field
    // source — e.g. workflow variables — isn't subject to that guard.
    const fieldsWithCustomId: FieldDef[] = [{ name: 'id', label: 'Custom Var Named Id', type: 'string' }]
    renderBuilder(
      <FilterBuilder group={groupWithCondition('id')} fields={fieldsWithCustomId} variables={[]} onChange={() => {}} />,
    )
    fireEvent.pointerDown(screen.getAllByRole('combobox')[0], { button: 0, pointerType: 'mouse' })

    expect(screen.getByRole('option', { name: 'Custom Var Named Id' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'ID' })).toBeNull()
  })
})
