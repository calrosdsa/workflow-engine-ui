// @vitest-environment jsdom
//
// Renders the real FilterBuilder to prove the relative-date affordance
// actually appears and switches modes. Written as a component test rather
// than a browser click-through because every surface that shows this control
// sits behind a sign-in, and this is repeatable besides.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FilterBuilder } from './FilterBuilder'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { FilterGroup } from '../types'
import type { FieldDef } from '@/features/forms/types'

afterEach(cleanup)

const DATE_FIELD: FieldDef = { name: 'due_date', label: 'Due Date', type: 'date' } as FieldDef
const TEXT_FIELD: FieldDef = { name: 'title', label: 'Title', type: 'string' } as FieldDef

function groupWith(field: string, extra: Record<string, unknown> = {}): FilterGroup {
  return {
    combinator: 'and',
    conditions: [{ id: 'c1', field, op: 'gte', value_mode: 'static', value: '', ...extra }],
    groups: [],
  } as FilterGroup
}

function renderBuilder(group: FilterGroup, fields: FieldDef[], allowRelativeDates: boolean) {
  const onChange = vi.fn()
  render(
    <I18nProvider>
      <FilterBuilder
        group={group}
        fields={fields}
        variables={[]}
        onChange={onChange}
        allowRelativeDates={allowRelativeDates}
      />
    </I18nProvider>,
  )
  return onChange
}

const TOGGLE = 'Use a relative date instead of a fixed one'

describe('FilterBuilder relative dates', () => {
  it('offers the switch on a date field when the surface opts in', () => {
    renderBuilder(groupWith('due_date'), [DATE_FIELD], true)
    expect(screen.getByLabelText(TOGGLE)).toBeTruthy()
  })

  // Default off: a surface that never opted in must look exactly as it did.
  it('offers nothing when the surface has not opted in', () => {
    renderBuilder(groupWith('due_date'), [DATE_FIELD], false)
    expect(screen.queryByLabelText(TOGGLE)).toBeNull()
  })

  // It is a date concept — a relative "title" is meaningless, and the
  // platform would refuse the condition anyway.
  it('offers nothing on a non-date field even when opted in', () => {
    renderBuilder(groupWith('title'), [TEXT_FIELD], true)
    expect(screen.queryByLabelText(TOGGLE)).toBeNull()
  })

  it('switches the condition into relative mode with a usable default', () => {
    const onChange = renderBuilder(groupWith('due_date'), [DATE_FIELD], true)

    fireEvent.click(screen.getByLabelText(TOGGLE))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as FilterGroup
    expect(next.conditions[0].value_mode).toBe('relative')
    // Lands on a valid token rather than an empty value the server would
    // reject if the author saved immediately.
    expect(next.conditions[0].value).toBe('today')
  })

  it('switches back to a fixed date and clears the relative token', () => {
    const group = groupWith('due_date', { value_mode: 'relative', value: 'start_of_month-1' })
    const onChange = renderBuilder(group, [DATE_FIELD], true)

    fireEvent.click(screen.getByLabelText('Switch back to a fixed date'))

    const next = onChange.mock.calls[0][0] as FilterGroup
    expect(next.conditions[0].value_mode).toBe('static')
    expect(next.conditions[0].value).toBe('')
  })

  // A relative mode left behind on a newly-chosen text field would be a
  // condition the server refuses at save.
  it('drops relative mode when the condition moves to another field', () => {
    const group = groupWith('due_date', { value_mode: 'relative', value: '-90d' })
    const onChange = renderBuilder(group, [DATE_FIELD, TEXT_FIELD], true)

    // The field picker is the first combobox in the row.
    const fieldPicker = screen.getAllByRole('combobox')[0]
    fireEvent.click(fieldPicker)
    fireEvent.click(screen.getByText('Title'))

    const next = onChange.mock.calls[0][0] as FilterGroup
    expect(next.conditions[0].value_mode).toBe('static')
  })
})
