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
    // Matches fields[0] exactly (including required/is_record_title/
    // searchable) so it's genuinely already consistent and this test
    // isolates what it means to test: appending the missing field touches
    // nothing else.
    existing.behavior.required = 'always'
    existing.isRecordTitle = true
    existing.searchable = true
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

  it('hydrates index/default from the backend onto an EXISTING layout element (API/MCP set them directly)', () => {
    // Reproduces the reported bug: a field already has a canvas element
    // (e.g. built earlier in the visual builder), then an MCP update_form
    // call sets index/default directly on the backend FieldDef with no
    // corresponding layout edit. Before this fix, index had no
    // representation in FormElement at all, and default was only
    // reconciled for brand-new (pass-2 synthesized) elements — an
    // already-covered element's stale/absent index and defaultValue would
    // silently win on the next unrelated builder save.
    const el = createElement('text')
    el.key = 'title'
    const schema = schemaWith([el])

    const healed = healSchema(schema, { fields: [{ ...fields[0], index: true, default: 'Untitled' }] })
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(healedEl.index).toBe(true)
    expect(healedEl.defaultValue).toBe('Untitled')

    // The real requirement: re-projecting the healed canvas (what an
    // unrelated builder save would submit) preserves both settings instead
    // of wiping them.
    const reprojected = projectToFields(healed).fields[0]
    expect(reprojected.index).toBe(true)
    expect(reprojected.default).toBe('Untitled')
  })

  it('un-hydrates index/default when the backend clears them, matching the reference_filter/hide_rules precedent', () => {
    const el = createElement('text')
    el.key = 'title'
    el.index = true
    el.defaultValue = 'Untitled'
    const schema = schemaWith([el])

    const healed = healSchema(schema, { fields: [fields[0]] }) // no index/default on the backend field
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(healedEl.index).toBeUndefined()
    expect(healedEl.defaultValue).toBeUndefined()
  })

  it('carries index/default when synthesizing a brand-new element for an API-created field', () => {
    const healed = healSchema(emptySchema(), {
      fields: [{ name: 'active', label: 'Active', type: 'boolean', index: true, default: true }],
    })
    const el = healed.sections[0].columns[0].elements[0]
    expect(el.index).toBe(true)
    expect(el.defaultValue).toBe(true)
    expect(projectToFields(healed).fields[0]).toMatchObject({ name: 'active', index: true, default: true })
  })

  it('reconciles index AND default on an enum (select) field — the exact reported repro', () => {
    // The reported bug's precise shape: an MCP update_form call sets
    // index+default on an existing enum field (e.g. a "status" select with
    // default "Draft"); the builder already has a layout element for it.
    // enum needed its own regression case because staticDefaultValue's
    // switch never had an 'enum' branch at all — a distinct gap from the
    // heal.ts reconciliation this test also exercises, caught only by
    // running the full hydrate-then-reproject round trip end to end.
    const el = createElement('select')
    el.key = 'status'
    el.options = [{ label: 'Draft', value: 'Draft' }, { label: 'Closed', value: 'Closed' }]
    const schema = schemaWith([el])

    const statusField: FieldDef = {
      name: 'status', label: 'Status', type: 'enum', enum_values: ['Draft', 'Closed'],
      index: true, default: 'Draft',
    }
    const healed = healSchema(schema, { fields: [statusField] })
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(healedEl.index).toBe(true)
    expect(healedEl.defaultValue).toBe('Draft')

    const reprojected = projectToFields(healed).fields[0]
    expect(reprojected.index).toBe(true)
    expect(reprojected.default).toBe('Draft')
  })

  it('index/default reconciliation is idempotent once the element already matches the backend', () => {
    const el = createElement('text')
    el.key = 'title'
    el.index = true
    el.defaultValue = 'Untitled'
    // fields[0] also sets required/is_record_title/searchable — matched here
    // too, or the required/searchable/is_record_title reconciliation added
    // below would (correctly) see drift and this wouldn't be a true no-op.
    el.behavior.required = 'always'
    el.isRecordTitle = true
    el.searchable = true
    const schema = schemaWith([el])
    const healed = healSchema(schema, { fields: [{ ...fields[0], index: true, default: 'Untitled' }] })
    expect(healed).toBe(schema) // no-op — same reference
  })

  it('reconciles required onto an EXISTING element, both directions, and leaves an expression-mode rule alone', () => {
    // Hydrate: backend says required, layout element doesn't know yet.
    const el = createElement('text')
    el.key = 'title'
    const hydrated = healSchema(schemaWith([el]), { fields: [{ ...fields[0], required: true }] })
    expect(hydrated.sections[0].columns[0].elements[0].behavior.required).toBe('always')

    // Un-hydrate: layout says always-required, backend cleared it.
    const stale = createElement('text')
    stale.key = 'title'
    stale.behavior.required = 'always'
    const unhydrated = healSchema(schemaWith([stale]), { fields: [{ ...fields[0], required: false }] })
    expect(unhydrated.sections[0].columns[0].elements[0].behavior.required).toBe('optional')

    // Carve-out: an element already governed by its own conditional-required
    // expression is left alone — elementToField can only ever project
    // `required: false` for it, so there is no backend `true` to adopt
    // without destroying the expression.
    const conditional = createElement('text')
    conditional.key = 'title'
    conditional.behavior.required = 'expression'
    conditional.behavior.requiredWhen = 'record.priority == "high"'
    const healedConditional = healSchema(schemaWith([conditional]), { fields: [{ ...fields[0], required: true }] })
    const healedEl = healedConditional.sections[0].columns[0].elements[0]
    expect(healedEl.behavior.required).toBe('expression')
    expect(healedEl.behavior.requiredWhen).toBe('record.priority == "high"')
  })

  it('reconciles unique onto an EXISTING element (backend is the truth), gated like projection gates it', () => {
    // Hydrate + un-hydrate on a type that supports unique.
    const el = createElement('text')
    el.key = 'notes'
    const hydrated = healSchema(schemaWith([el]), { fields: [{ ...fields[1], unique: true }] })
    expect(hydrated.sections[0].columns[0].elements[0].unique).toBe(true)

    const stale = createElement('text')
    stale.key = 'notes'
    stale.unique = true
    const unhydrated = healSchema(schemaWith([stale]), { fields: [fields[1]] }) // backend has no unique
    expect(unhydrated.sections[0].columns[0].elements[0].unique).toBeUndefined()

    // Gating: a component projection would never emit `unique` for (here, a
    // 'select') is left alone even if the backend somehow carries it —
    // hydrating it would just be stripped again by the very next save,
    // which would make healing non-idempotent.
    const notUnique = createElement('select')
    notUnique.key = 'status'
    notUnique.options = [{ label: 'Draft', value: 'Draft' }, { label: 'Closed', value: 'Closed' }]
    const healedNotUnique = healSchema(schemaWith([notUnique]), {
      fields: [{ ...fields[2], unique: true }],
    })
    expect(healedNotUnique.sections[0].columns[0].elements[0].unique).toBeUndefined()
  })

  it('reconciles searchable and is_record_title onto an EXISTING element, both directions', () => {
    const el = createElement('text')
    el.key = 'notes'
    const hydrated = healSchema(schemaWith([el]), {
      fields: [{ ...fields[1], searchable: true, is_record_title: true }],
    })
    const hydratedEl = hydrated.sections[0].columns[0].elements[0]
    expect(hydratedEl.searchable).toBe(true)
    expect(hydratedEl.isRecordTitle).toBe(true)

    const stale = createElement('text')
    stale.key = 'notes'
    stale.searchable = true
    stale.isRecordTitle = true
    const unhydrated = healSchema(schemaWith([stale]), { fields: [fields[1]] }) // backend clears both
    const unhydratedEl = unhydrated.sections[0].columns[0].elements[0]
    expect(unhydratedEl.searchable).toBeUndefined()
    expect(unhydratedEl.isRecordTitle).toBeUndefined()
  })

  it('reconciles enum_values onto an EXISTING enum element — adds, drops, and preserves survivor labels', () => {
    const el = createElement('select')
    el.key = 'status'
    el.options = [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }]
    const schema = schemaWith([el])

    // Backend gained "archived" (via MCP) and dropped "closed".
    const healed = healSchema(schema, {
      fields: [{ ...fields[2], enum_values: ['open', 'archived'] }],
    })
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(healedEl.options).toEqual([
      { label: 'Open', value: 'open' }, // survivor keeps its builder-authored label
      { label: 'archived', value: 'archived' }, // new value falls back to itself
    ])

    // The real requirement: re-projecting reproduces the backend's exact set.
    expect(projectToFields(healed).fields[0].enum_values).toEqual(['open', 'archived'])
  })

  it('reconciles display_field onto an EXISTING form-reference element, both directions', () => {
    const el = createElement('form')
    el.key = 'owner'
    el.formRef = 'form-users'
    const hydrated = healSchema(schemaWith([el]), { fields: [fields[3]] }) // display_field: 'full_name'
    expect(hydrated.sections[0].columns[0].elements[0].displayField).toBe('full_name')

    const stale = createElement('form')
    stale.key = 'owner'
    stale.formRef = 'form-users'
    stale.displayField = 'full_name'
    const unhydrated = healSchema(schemaWith([stale]), { fields: [{ ...fields[3], display_field: undefined }] })
    expect(unhydrated.sections[0].columns[0].elements[0].displayField).toBeUndefined()
  })

  it("reconciles File Upload's max_file_size_bytes/allowed_mime_types, both directions, and carries them into synthesis", () => {
    const fileField: FieldDef = {
      name: 'attachment', label: 'Attachment', type: 'file',
      max_file_size_bytes: 5_000_000, allowed_mime_types: ['application/pdf'],
    }

    // Hydrate onto an existing element.
    const el = createElement('file')
    el.key = 'attachment'
    const hydrated = healSchema(schemaWith([el]), { fields: [fileField] })
    const hydratedEl = hydrated.sections[0].columns[0].elements[0]
    expect(hydratedEl.validation.maxFileSizeBytes).toBe(5_000_000)
    expect(hydratedEl.validation.allowedMimeTypes).toEqual(['application/pdf'])

    // Un-hydrate: backend cleared both — a stale/absent layout value would
    // otherwise silently WIDEN what the next save accepts.
    const stale = createElement('file')
    stale.key = 'attachment'
    stale.validation.maxFileSizeBytes = 5_000_000
    stale.validation.allowedMimeTypes = ['application/pdf']
    const unhydrated = healSchema(schemaWith([stale]), {
      fields: [{ name: 'attachment', label: 'Attachment', type: 'file' }],
    })
    const unhydratedEl = unhydrated.sections[0].columns[0].elements[0]
    expect(unhydratedEl.validation.maxFileSizeBytes).toBeUndefined()
    expect(unhydratedEl.validation.allowedMimeTypes).toBeUndefined()

    // Synthesis: a brand-new element for this field starts with both set,
    // not just an existing one that gets reconciled.
    const synthesized = healSchema(emptySchema(), { fields: [fileField] })
    const synthesizedEl = synthesized.sections[0].columns[0].elements[0]
    expect(synthesizedEl.validation.maxFileSizeBytes).toBe(5_000_000)
    expect(synthesizedEl.validation.allowedMimeTypes).toEqual(['application/pdf'])
  })

  it('is a no-op — same reference — for a form that is already consistent', () => {
    const el = createElement('text')
    el.key = 'title'
    // Matches fields[0] exactly, including the properties reconciled above.
    el.behavior.required = 'always'
    el.isRecordTitle = true
    el.searchable = true
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
