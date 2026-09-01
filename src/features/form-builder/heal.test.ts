import { describe, expect, it } from 'vitest'
import { healSchema } from './heal'
import { resolveFormSchema } from './serialize'
import { emptySchema } from './schema'
import { createElement, createSection } from './factory'
import { projectToFields } from './projection'
import type { FormSchema } from './schema'
import type { FieldDef } from '@/features/forms/types'

function schemaWith(elements: ReturnType<typeof createElement>[]): FormSchema {
  const section = createSection('Details', '1')
  section.columns[0].elements = elements
  return { version: 1, sections: [section], settings: emptySchema().settings }
}

const fields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'string', required: true, is_record_title: true, searchable: true, column: 'col_t1' },
  { name: 'notes', label: 'Notes', type: 'text' },
  { name: 'status', label: 'Status', type: 'enum', enum_values: ['open', 'closed'] },
  { name: 'owner', label: 'Owner', type: 'reference', reference_table: 'form-users', display_field: 'full_name' },
]

describe('healSchema', () => {
  it('synthesizes every field into an API-created form with no layout, ready to render and to round-trip', () => {
    const healed = healSchema(emptySchema(), { fields })

    const els = healed.sections.flatMap((s) => s.columns.flatMap((c) => c.elements))
    expect(els.map((e) => e.key)).toEqual(['title', 'notes', 'status', 'owner'])

    const byKey = Object.fromEntries(els.map((e) => [e.key, e]))
    // The round-trip property is the real requirement: projecting the healed
    // canvas must reproduce the backend fields, or the next builder save
    // would mutate the form it merely displayed.
    expect(byKey.notes.component).toBe('textarea') // NOT single-line 'text' — that projects to type string
    expect(byKey.status.component).toBe('select')
    expect(byKey.status.options?.map((o) => o.value)).toEqual(['open', 'closed'])
    expect(byKey.owner.component).toBe('form')
    expect(byKey.owner.formRef).toBe('form-users')
    expect(byKey.owner.displayField).toBe('full_name')
    expect(byKey.title.behavior.required).toBe('always')
    expect(byKey.title.isRecordTitle).toBe(true)
    expect(byKey.title.searchable).toBe(true)
    expect(byKey.title.column).toBe('col_t1') // physical identity threaded through

    const projected = projectToFields(healed).fields
    expect(projected.map((f) => [f.name, f.type])).toEqual([
      ['title', 'string'],
      ['notes', 'text'],
      ['status', 'enum'],
      ['owner', 'reference'],
    ])
  })

  it('appends only the missing field and leaves covered sections untouched by reference', () => {
    const existing = createElement('text')
    existing.key = 'title'
    const schema = schemaWith([existing])

    const healed = healSchema(schema, { fields: [fields[0], fields[2]] })
    const els = healed.sections[0].columns[0].elements
    expect(els.map((e) => e.key)).toEqual(['title', 'status'])
    expect(els[0]).toBe(existing) // covered element untouched
  })

  it('drops a configured element whose field the API deleted — the resurrection bug', () => {
    const ghost = createElement('text')
    ghost.key = 'deleted_by_api'
    const keep = createElement('text')
    keep.key = 'title'
    const healed = healSchema(schemaWith([keep, ghost]), { fields: [fields[0]] })

    const keys = healed.sections[0].columns[0].elements.map((e) => e.key)
    expect(keys).toEqual(['title'])
    // And the proof it can't resurrect: projection of the healed schema no
    // longer emits the deleted field.
    expect(projectToFields(healed).fields.map((f) => f.name)).toEqual(['title'])
  })

  it('keeps presentational elements and unconfigured work-in-progress elements', () => {
    const para = createElement('paragraph')
    const wipRef = createElement('form') // no formRef picked yet — projection skips it
    wipRef.key = 'later'
    const healed = healSchema(schemaWith([para, wipRef]), { fields: [] })

    expect(healed.sections[0].columns[0].elements).toHaveLength(2)
  })

  it('never synthesizes system-managed parent_link fields', () => {
    const healed = healSchema(emptySchema(), {
      fields: [{ name: 'parent', label: 'Parent', type: 'parent_link', reference_table: 'form-x' }],
    })
    expect(healed.sections).toHaveLength(0)
    expect(healed).not.toBe(emptySchema()) // identity check is meaningless here…
  })

  it('hydrates create-user settings FROM the backend mirrors, both directions', () => {
    // API enabled provisioning; the layout knows nothing about it.
    const on = healSchema(emptySchema(), {
      fields: [],
      create_user_on_submit: true,
      create_user_email_field: 'email',
      create_user_role_field: 'role',
    })
    expect(on.settings?.createUser.enabled).toBe(true)
    expect(on.settings?.createUser.emailFieldKey).toBe('email')
    expect(on.settings?.createUser.roleFieldKey).toBe('role')

    // API disabled it; a stale layout still says enabled. Backend wins —
    // otherwise the next builder save would re-assert the stale value.
    const stale = emptySchema()
    stale.settings!.createUser = { ...stale.settings!.createUser, enabled: true, emailFieldKey: 'email' }
    const off = healSchema(stale, { fields: [], create_user_on_submit: false })
    expect(off.settings?.createUser.enabled).toBe(false)
    expect(off.settings?.createUser.emailFieldKey).toBeUndefined()
  })

  it('is a no-op — same reference — for a form that is already consistent', () => {
    const el = createElement('text')
    el.key = 'title'
    const schema = schemaWith([el])
    const healed = healSchema(schema, { fields: [fields[0]] })
    expect(healSchema(healed, { fields: [fields[0]] })).toBe(healed)
    expect(healed).toBe(schema)
  })
})

describe('resolveFormSchema', () => {
  it('turns a layoutless API-created form into a renderable schema', () => {
    const schema = resolveFormSchema({ layout: null, fields })
    const keys = schema.sections.flatMap((s) => s.columns.flatMap((c) => c.elements.map((e) => e.key)))
    expect(keys).toEqual(['title', 'notes', 'status', 'owner'])
  })

  it('returns an empty schema for a missing form', () => {
    expect(resolveFormSchema(null).sections).toHaveLength(0)
    expect(resolveFormSchema(undefined).sections).toHaveLength(0)
  })
})
