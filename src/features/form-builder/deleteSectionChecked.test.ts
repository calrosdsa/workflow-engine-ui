import { describe, it, expect, beforeEach } from 'vitest'
import {
  useFormBuilderStore, insertAccountSection, deleteSectionChecked,
} from './store'
import { createSection } from './factory'

// Guards against a real bug: deleting the auto-injected Account section via
// the ordinary per-section delete control (SectionCard's dropdown) used to
// call the generic tree-store core's deleteSection directly, which has no
// CreateUserSettings concept (page-builder, its other consumer, shares
// nothing like it) -- leaving create_user_on_submit enabled and pointing at
// field keys that no longer existed on the form, silently breaking account
// provisioning on every future submit.

beforeEach(() => {
  useFormBuilderStore.getState().reset()
})

describe('deleteSectionChecked', () => {
  it('clears CreateUserSettings when the deleted section is the tracked Account section', () => {
    insertAccountSection()
    const accountId = useFormBuilderStore.getState().schema.settings?.createUser.accountSectionId
    expect(accountId).toBeTruthy()

    deleteSectionChecked(accountId!)

    const settings = useFormBuilderStore.getState().schema.settings?.createUser
    expect(settings?.enabled).toBe(false)
    expect(settings?.accountSectionId).toBeUndefined()
    expect(settings?.nameFieldKey).toBeUndefined()
    expect(settings?.emailFieldKey).toBeUndefined()
    expect(settings?.roleFieldKey).toBeUndefined()
  })

  it('actually removes the Account section from the canvas, same as an ordinary delete', () => {
    insertAccountSection()
    const accountId = useFormBuilderStore.getState().schema.settings?.createUser.accountSectionId!

    deleteSectionChecked(accountId)

    const stillPresent = useFormBuilderStore.getState().schema.sections.some((s) => s.id === accountId)
    expect(stillPresent).toBe(false)
  })

  it('does NOT touch CreateUserSettings when an unrelated section is deleted', () => {
    insertAccountSection()
    const ordinary = createSection('Details')
    useFormBuilderStore.setState((s) => ({
      schema: { ...s.schema, sections: [...s.schema.sections, ordinary] },
    }))
    const settingsBefore = useFormBuilderStore.getState().schema.settings?.createUser

    deleteSectionChecked(ordinary.id)

    const settingsAfter = useFormBuilderStore.getState().schema.settings?.createUser
    expect(settingsAfter).toEqual(settingsBefore)
    expect(settingsAfter?.enabled).toBe(true)
    expect(settingsAfter?.accountSectionId).toBeTruthy()
  })

  it('is a no-op on CreateUserSettings when Create User was never enabled', () => {
    const ordinary = createSection('Details')
    useFormBuilderStore.setState((s) => ({
      schema: { ...s.schema, sections: [...s.schema.sections, ordinary] },
    }))

    expect(() => deleteSectionChecked(ordinary.id)).not.toThrow()
    expect(useFormBuilderStore.getState().schema.settings?.createUser.enabled).toBeFalsy()
  })
})
