// @vitest-environment jsdom
//
// The viewer-scoped half of FilterBuilder: with `viewerModes`, a condition's
// value can come from the current user's account record or hop through a
// sibling reference — and expressions must be unreachable, because the
// server refuses them on these surfaces (reference_filter et al).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { FilterBuilder, newGroup, type ViewerFilterContext } from './FilterBuilder'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup, FilterCondition } from '../types'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

// The this_record attribute picker loads the hop target's fields on demand.
vi.mock('@/features/forms/hooks', () => ({
  useForm: (id: string) => ({
    data:
      id === 'form-employees'
        ? { id: 'form-employees', fields: [{ name: 'department', label: 'Department', type: 'string' }] }
        : undefined,
  }),
}))

afterEach(cleanup)

const targetFields: FieldDef[] = [{ name: 'area', label: 'Area', type: 'string' }]

const viewerModes: ViewerFilterContext = {
  currentUserAttrs: [
    { value: 'record_id', label: 'Their Employee record' },
    { value: 'user_id', label: 'Their user id' },
    { value: 'email', label: 'Their email' },
    { value: 'area', label: 'Their Area' },
  ],
  currentUserHint: 'Attributes come from the viewer\'s "Employee" record, matched by email.',
  thisRecordRefs: [{ name: 'manager', label: 'Manager', targetFormId: 'form-employees' }],
}

function groupWith(condition: Partial<FilterCondition>): FilterGroup {
  const g = newGroup()
  g.conditions.push({ id: 'c1', field: 'area', op: 'eq', value_mode: 'static', value: '', ...condition } as FilterCondition)
  return g
}

function renderViewer(condition: Partial<FilterCondition>, onChange: (g: FilterGroup) => void = () => {}) {
  return render(
    <FilterBuilder
      group={groupWith(condition)}
      fields={targetFields}
      variables={[]}
      viewerModes={viewerModes}
      onChange={onChange}
    />,
  )
}

describe('FilterBuilder viewer modes', () => {
  it('offers the three value sources and switching one resets the value', () => {
    let latest: FilterGroup | undefined
    renderViewer({}, (g) => { latest = g })

    // Comboboxes in order: field, operator, value source.
    fireEvent.pointerDown(screen.getAllByRole('combobox')[2], { button: 0, pointerType: 'mouse' })
    expect(screen.getByRole('option', { name: 'Fixed value' })).toBeTruthy()
    expect(screen.getByRole('option', { name: "This record's…" })).toBeTruthy()

    // Radix's SelectItem selects on plain click for non-mouse pointers, and
    // jsdom pointer events never carry pointerType — so click is the path
    // that actually commits here (pointerup only selects for real mice).
    fireEvent.click(screen.getByRole('option', { name: "Current user's…" }))
    expect(latest?.conditions[0].value_mode).toBe('current_user')
    expect(latest?.conditions[0].value).toBe('')
  })

  it('renders the current_user attribute picker with the account attributes and the hint', () => {
    renderViewer({ value_mode: 'current_user', value: 'area' })

    // The already-selected attribute reads as its label, not the raw name.
    const triggers = screen.getAllByRole('combobox')
    expect(triggers[3].textContent).toBe('Their Area')
    expect(screen.getByText(/matched by email/)).toBeTruthy()

    fireEvent.pointerDown(triggers[3], { button: 0, pointerType: 'mouse' })
    expect(screen.getByRole('option', { name: 'Their Employee record' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Their email' })).toBeTruthy()
  })

  it('parses this_record\'s "<ref>.<attr>" into the two pickers, attrs from the hop target form', () => {
    renderViewer({ value_mode: 'this_record', value: 'manager.department' })

    const triggers = screen.getAllByRole('combobox')
    expect(triggers[3].textContent).toBe('Manager')
    expect(triggers[4].textContent).toBe('Department') // label came from the mocked hop form

    let latest: FilterGroup | undefined
    cleanup()
    renderViewer({ value_mode: 'this_record', value: 'manager.' }, (g) => { latest = g })
    fireEvent.pointerDown(screen.getAllByRole('combobox')[4], { button: 0, pointerType: 'mouse' })
    fireEvent.click(screen.getByRole('option', { name: 'Department' }))
    expect(latest?.conditions[0].value).toBe('manager.department')
  })

  it('never offers expressions, and drops the workflow-only operators', () => {
    renderViewer({})
    expect(screen.queryByTitle('Use an expression instead of a static value')).toBeNull()

    fireEvent.pointerDown(screen.getAllByRole('combobox')[1], { button: 0, pointerType: 'mouse' })
    expect(screen.getByRole('option', { name: '=' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'was updated' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'full-text search' })).toBeNull()
  })
})
