// @vitest-environment jsdom
//
// The shared current_user attribute list/hint — extracted from
// form-builder's ReferenceFilterSection (P1) and now also driving menu/
// dashboard-widget/saved-view filter sections (P2). Pins the three
// account-form-discovery outcomes: none, exactly one, and ambiguous.
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCurrentUserAttrs } from './useCurrentUserAttrs'

const forms = vi.hoisted(() => ({ list: [] as { id: string; create_user_on_submit?: boolean; name?: string }[] }))

vi.mock('@/features/forms/hooks', () => ({
  useForms: () => ({ data: forms.list }),
  useForm: (id: string) => ({
    data:
      id === 'employee-form'
        ? {
            id: 'employee-form',
            fields: [
              { name: 'area', label: 'Area', type: 'string' },
              // Excluded types must not surface as pickable attributes.
              { name: 'manager', label: 'Manager', type: 'parent_link' },
              { name: 'reports', label: 'Reports', type: 'line_item_count' },
            ],
          }
        : undefined,
  }),
}))

describe('useCurrentUserAttrs', () => {
  it('offers only the built-ins with an honest hint when no form creates user accounts', () => {
    forms.list = [{ id: 'f1', create_user_on_submit: false }]
    const { result } = renderHook(() => useCurrentUserAttrs())
    expect(result.current.currentUserAttrs.map((a) => a.value)).toEqual(['record_id', 'user_id', 'email'])
    expect(result.current.currentUserHint).toMatch(/No form in this app creates user accounts/)
  })

  it("adds the account form's own fields (excluding non-scalar types) when exactly one exists", () => {
    forms.list = [{ id: 'employee-form', name: 'Employee', create_user_on_submit: true }]
    const { result } = renderHook(() => useCurrentUserAttrs())
    expect(result.current.currentUserAttrs.map((a) => a.value)).toEqual(['record_id', 'user_id', 'email', 'area'])
    expect(result.current.currentUserAttrs[0].label).toBe('Their Employee record')
    expect(result.current.currentUserHint).toContain('Employee')
    expect(result.current.currentUserHint).toContain('matched by email')
  })

  it('falls back to built-ins with an ambiguity hint when several forms create accounts', () => {
    forms.list = [
      { id: 'f1', create_user_on_submit: true },
      { id: 'f2', create_user_on_submit: true },
    ]
    const { result } = renderHook(() => useCurrentUserAttrs())
    expect(result.current.currentUserAttrs.map((a) => a.value)).toEqual(['record_id', 'user_id', 'email'])
    expect(result.current.currentUserHint).toMatch(/Several forms create user accounts/)
  })
})
