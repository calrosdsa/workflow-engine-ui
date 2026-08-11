import { describe, it, expect } from 'vitest'
import { withHiddenField, withHiddenFieldGroup } from './RoleFormDrawer'

// FR-C7-003: hidden_fields previously had no editor UI at all — the field
// was round-tripped unchanged through RoleFormDrawer's save. These test the
// two pure state-update functions backing the new "Hide fields from this
// role" section, most importantly that unchecking a form's last hidden
// field drops that form's key entirely rather than leaving a stale empty
// array (which would round-trip as {"<form_id>": []} — harmless to the
// backend's masking behavior, but noise in every future GET response).

describe('withHiddenField', () => {
  it('adds a field to an empty map', () => {
    expect(withHiddenField({}, 'form-1', 'email', true)).toEqual({ 'form-1': ['email'] })
  })

  it('adds a second field to an existing form entry', () => {
    const prev = { 'form-1': ['email'] }
    expect(withHiddenField(prev, 'form-1', 'ssn', true)).toEqual({ 'form-1': ['email', 'ssn'] })
  })

  it('is idempotent when the field is already present', () => {
    const prev = { 'form-1': ['email'] }
    expect(withHiddenField(prev, 'form-1', 'email', true)).toEqual({ 'form-1': ['email'] })
  })

  it('removes one field, keeping the others', () => {
    const prev = { 'form-1': ['email', 'ssn'] }
    expect(withHiddenField(prev, 'form-1', 'email', false)).toEqual({ 'form-1': ['ssn'] })
  })

  it('drops the form key entirely when its last hidden field is unchecked', () => {
    const prev = { 'form-1': ['email'], 'form-2': ['ssn'] }
    expect(withHiddenField(prev, 'form-1', 'email', false)).toEqual({ 'form-2': ['ssn'] })
  })

  it('unchecking a field never present is a no-op', () => {
    const prev = { 'form-1': ['email'] }
    expect(withHiddenField(prev, 'form-1', 'ssn', false)).toEqual({ 'form-1': ['email'] })
  })

  it('leaves other forms untouched', () => {
    const prev = { 'form-1': ['email'], 'form-2': ['phone'] }
    expect(withHiddenField(prev, 'form-1', 'name', true)).toEqual({ 'form-1': ['email', 'name'], 'form-2': ['phone'] })
  })

  it('does not mutate the input map', () => {
    const prev = { 'form-1': ['email'] }
    withHiddenField(prev, 'form-1', 'ssn', true)
    expect(prev).toEqual({ 'form-1': ['email'] })
  })
})

describe('withHiddenFieldGroup', () => {
  it('checking the group sets every given field name for the form, replacing any prior selection', () => {
    const prev = { 'form-1': ['email'] }
    expect(withHiddenFieldGroup(prev, 'form-1', ['email', 'ssn', 'name'], true)).toEqual({ 'form-1': ['email', 'ssn', 'name'] })
  })

  it('unchecking the group drops the form key entirely, regardless of the field list passed', () => {
    const prev = { 'form-1': ['email', 'ssn'], 'form-2': ['phone'] }
    expect(withHiddenFieldGroup(prev, 'form-1', ['email', 'ssn'], false)).toEqual({ 'form-2': ['phone'] })
  })

  it('checking the group on a form with no prior entry adds it', () => {
    expect(withHiddenFieldGroup({}, 'form-1', ['email', 'ssn'], true)).toEqual({ 'form-1': ['email', 'ssn'] })
  })

  it('leaves other forms untouched', () => {
    const prev = { 'form-1': ['email'], 'form-2': ['phone'] }
    expect(withHiddenFieldGroup(prev, 'form-1', ['email', 'ssn'], true)).toEqual({ 'form-1': ['email', 'ssn'], 'form-2': ['phone'] })
  })

  it('does not mutate the input map', () => {
    const prev = { 'form-1': ['email'] }
    withHiddenFieldGroup(prev, 'form-1', ['ssn'], true)
    expect(prev).toEqual({ 'form-1': ['email'] })
  })
})
