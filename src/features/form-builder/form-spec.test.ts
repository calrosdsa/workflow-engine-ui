import { describe, it, expect } from 'vitest'
import {
  parseFormSpec, toCompactSpec, toNativeSpec, resolveComponentType, compactLossReport,
} from './form-spec'
import { projectToFields } from './projection'
import { createSection, createElement } from './factory'
import type { FormSchema } from './schema'

function ok(result: ReturnType<typeof parseFormSpec>) {
  if (!result.ok) throw new Error(`expected parse to succeed, got: ${result.errors.join('; ')}`)
  return result
}

describe('resolveComponentType', () => {
  it('accepts builder component types verbatim', () => {
    expect(resolveComponentType('textarea')).toBe('textarea')
    expect(resolveComponentType('multiselect')).toBe('multiselect')
  })

  it('accepts backend FieldType names as aliases', () => {
    expect(resolveComponentType('string')).toBe('text')
    expect(resolveComponentType('integer')).toBe('number')
    expect(resolveComponentType('decimal')).toBe('number')
    expect(resolveComponentType('boolean')).toBe('checkbox')
    expect(resolveComponentType('enum')).toBe('select')
    expect(resolveComponentType('reference')).toBe('form')
  })

  it('normalises case, spaces and hyphens', () => {
    expect(resolveComponentType('Multi Select')).toBe('multiselect')
    expect(resolveComponentType('LONG-TEXT')).toBe('textarea')
  })

  it('resolves "text" to the single-line input, not the textarea', () => {
    // The one genuinely ambiguous name: 'text' is a single-line component in
    // the builder and a textarea hint in the backend's vocabulary.
    expect(resolveComponentType('text')).toBe('text')
    expect(resolveComponentType('longtext')).toBe('textarea')
  })

  it('returns null for an unknown type', () => {
    expect(resolveComponentType('quantum')).toBeNull()
    expect(resolveComponentType(undefined)).toBeNull()
  })
})

describe('parseFormSpec — rejection', () => {
  it('rejects invalid JSON with the parser message', () => {
    const r = parseFormSpec('{ not json')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid json/i)
  })

  it('rejects an empty string', () => {
    expect(parseFormSpec('   ').ok).toBe(false)
  })

  it('rejects an array', () => {
    expect(parseFormSpec('[]').ok).toBe(false)
  })

  it('rejects a spec with no name', () => {
    const r = parseFormSpec({ fields: [{ label: 'A', type: 'text' }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/name/i)
  })
})

describe('parseFormSpec — compact', () => {
  it('builds a real layout from a flat field list', () => {
    const r = ok(parseFormSpec({
      name: 'Purchase Order',
      fields: [
        { label: 'Vendor', type: 'text', required: true },
        { label: 'Amount', type: 'number' },
      ],
    }))

    expect(r.mode).toBe('compact')
    expect(r.form.name).toBe('Purchase Order')
    expect(r.form.slug).toBe('purchase_order')
    // The point of the generator: a canvas the builder can actually render,
    // not just fields[] with an empty layout.
    expect(r.form.schema.sections).toHaveLength(1)
    const elements = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(elements.map((e) => e.label)).toEqual(['Vendor', 'Amount'])
    expect(elements[0].behavior.required).toBe('always')
    expect(elements[1].component).toBe('number')
  })

  it('projects to backend fields that survive the real projection', () => {
    const r = ok(parseFormSpec({
      name: 'Order',
      fields: [
        { label: 'Customer Name', type: 'string', searchable: true, recordTitle: true },
        { label: 'Status', type: 'enum', options: ['Draft', 'Sent'] },
      ],
    }))

    const { fields } = projectToFields(r.form.schema)
    expect(fields.map((f) => f.name)).toEqual(['customer_name', 'status'])
    expect(fields[0].type).toBe('string')
    expect(fields[0].searchable).toBe(true)
    expect(fields[0].is_record_title).toBe(true)
    expect(fields[1].type).toBe('enum')
    expect(fields[1].enum_values).toEqual(['draft', 'sent'])
  })

  it('deals fields across a multi-column section', () => {
    const r = ok(parseFormSpec({
      name: 'Two Up',
      sections: [{
        title: 'Details',
        layout: '2',
        fields: [
          { label: 'First', type: 'text' },
          { label: 'Second', type: 'text' },
          { label: 'Third', type: 'text' },
        ],
      }],
    }))

    const [section] = r.form.schema.sections
    expect(section.columns).toHaveLength(2)
    expect(section.columns[0].elements.map((e) => e.label)).toEqual(['First', 'Third'])
    expect(section.columns[1].elements.map((e) => e.label)).toEqual(['Second'])
  })

  it('accepts a plain column count as a layout', () => {
    const r = ok(parseFormSpec({
      name: 'Three Up',
      sections: [{ title: 'D', columns: 3, fields: [{ label: 'A', type: 'text' }] }],
    }))
    expect(r.form.schema.sections[0].columns).toHaveLength(3)
  })

  it('warns and falls back on an unknown layout', () => {
    const r = ok(parseFormSpec({
      name: 'Odd',
      sections: [{ title: 'D', layout: 'seventeen', fields: [{ label: 'A', type: 'text' }] }],
    }))
    expect(r.form.schema.sections[0].columns).toHaveLength(1)
    expect(r.warnings.join(' ')).toMatch(/unknown layout/i)
  })

  it('de-duplicates keys across the whole form, not just per section', () => {
    const r = ok(parseFormSpec({
      name: 'Dupes',
      sections: [
        { title: 'One', fields: [{ key: 'total', label: 'Total', type: 'number' }] },
        { title: 'Two', fields: [{ key: 'total', label: 'Total Again', type: 'number' }] },
      ],
    }))

    const keys = r.form.schema.sections.flatMap((s) => s.columns.flatMap((c) => c.elements.map((e) => e.key)))
    expect(keys).toEqual(['total', 'total_2'])
    // And the projection agrees — two distinct columns, no silent collision.
    expect(projectToFields(r.form.schema).fields.map((f) => f.name)).toEqual(['total', 'total_2'])
  })

  it('renames a reserved key rather than aliasing a real column', () => {
    const r = ok(parseFormSpec({
      name: 'Reserved',
      fields: [{ key: 'id', label: 'Id', type: 'text' }],
    }))
    const [el] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(el.key).toBe('id_field')
  })

  it('skips an unknown type with a warning instead of failing the import', () => {
    const r = ok(parseFormSpec({
      name: 'Partly Good',
      fields: [
        { label: 'Fine', type: 'text' },
        { label: 'Bad', type: 'quantum' },
      ],
    }))
    const elements = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(elements).toHaveLength(1)
    expect(r.warnings.join(' ')).toMatch(/unknown type "quantum"/i)
  })

  it('normalises both option shapes', () => {
    const r = ok(parseFormSpec({
      name: 'Options',
      fields: [
        { label: 'Plain', type: 'select', options: ['Yes please', 'No thanks'] },
        { label: 'Pairs', type: 'select', options: [{ label: 'High', value: 'H' }] },
      ],
    }))
    const [plain, pairs] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(plain.options).toEqual([
      { label: 'Yes please', value: 'yes_please' },
      { label: 'No thanks', value: 'no_thanks' },
    ])
    expect(pairs.options).toEqual([{ label: 'High', value: 'H' }])
  })

  it('warns about a choice field with no options and a reference with no target', () => {
    const r = ok(parseFormSpec({
      name: 'Incomplete',
      fields: [
        { label: 'Pick', type: 'select' },
        { label: 'Owner', type: 'reference' },
      ],
    }))
    expect(r.warnings.join(' ')).toMatch(/no "options"/i)
    expect(r.warnings.join(' ')).toMatch(/no "formRef"/i)
  })

  it('carries hidden/readOnly/unique/width/validation through', () => {
    const r = ok(parseFormSpec({
      name: 'Rich',
      fields: [{
        label: 'Code', type: 'text', unique: true, hidden: true, readOnly: true,
        width: 'half', minLength: 2, maxLength: 8, pattern: '^[A-Z]+$',
      }],
    }))
    const [el] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(el.unique).toBe(true)
    expect(el.behavior.visibility).toBe('hidden')
    expect(el.behavior.readOnly).toBe('always')
    expect(el.appearance.width).toBe('half')
    expect(el.validation).toMatchObject({ minLength: 2, maxLength: 8, pattern: '^[A-Z]+$' })
  })

  it('accepts a string payload as readily as an object', () => {
    const r = ok(parseFormSpec('{"name":"From String","fields":[{"label":"A","type":"text"}]}'))
    expect(r.form.name).toBe('From String')
  })

  it('warns when a spec has no fields at all', () => {
    const r = ok(parseFormSpec({ name: 'Empty' }))
    expect(r.form.schema.sections).toHaveLength(0)
    expect(r.warnings.join(' ')).toMatch(/no fields/i)
  })
})

describe('parseFormSpec — native', () => {
  function nativeSchema(): FormSchema {
    const section = createSection('Details', '1')
    const el = createElement('text')
    el.label = 'Vendor'
    el.key = 'vendor'
    el.behavior.visibility = 'expression'
    el.behavior.visibleWhen = 'amount > 100'
    section.columns[0].elements.push(el)
    return { version: 1, sections: [section] }
  }

  it('is detected by a structurally valid layout and adopted verbatim', () => {
    const r = ok(parseFormSpec({ name: 'Native', layout: nativeSchema() }))
    expect(r.mode).toBe('native')
    const [el] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    // The whole point of native mode: rules the compact shape can't express
    // survive the round trip untouched.
    expect(el.behavior.visibility).toBe('expression')
    expect(el.behavior.visibleWhen).toBe('amount > 100')
  })

  it('falls back to compact when layout is present but malformed', () => {
    const r = ok(parseFormSpec({
      name: 'Broken Layout',
      layout: { version: 1, sections: 'not an array' },
      fields: [{ label: 'A', type: 'text' }],
    }))
    expect(r.mode).toBe('compact')
    expect(r.form.schema.sections).toHaveLength(1)
  })

  it('repairs a section with no columns rather than dropping it', () => {
    const r = ok(parseFormSpec({
      name: 'Columnless',
      layout: { version: 1, sections: [{ id: 's1', title: 'Orphan', layout: '1' }] },
    }))
    expect(r.form.schema.sections[0].columns).toHaveLength(1)
    expect(r.warnings.join(' ')).toMatch(/no columns/i)
  })

  it('round-trips a native export back to the same sections', () => {
    const state = { name: 'Round Trip', slug: 'round_trip', description: 'd', schema: nativeSchema() }
    const r = ok(parseFormSpec(toNativeSpec(state)))
    // Sections must survive byte-for-byte. The schema as a whole doesn't:
    // hydration fills in `settings` the same way loading any saved form
    // does (parseLayout), which is normalisation, not loss.
    expect(r.form.schema.sections).toEqual(state.schema.sections)
    expect(r.form.schema.settings).toBeDefined()
  })
})

describe('carryColumnsForward (editing an existing form)', () => {
  function existing(): FormSchema {
    const section = createSection('Details', '1')
    const keep = createElement('text')
    keep.label = 'Vendor'; keep.key = 'vendor'; keep.column = 'vendor_a1b2'
    const drop = createElement('text')
    drop.label = 'Legacy'; drop.key = 'legacy'; drop.column = 'legacy_c3d4'
    section.columns[0].elements.push(keep, drop)
    return { version: 1, sections: [section] }
  }

  it('preserves the physical column of a field the spec kept', () => {
    const r = ok(parseFormSpec(
      { name: 'Edited', fields: [{ key: 'vendor', label: 'Vendor Name', type: 'text' }] },
      { existingSchema: existing() },
    ))
    const [el] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    // Relabelling must NOT orphan the data — the column is matched by key.
    expect(el.label).toBe('Vendor Name')
    expect(el.column).toBe('vendor_a1b2')
  })

  it('warns about fields the spec dropped, naming the data at risk', () => {
    const r = ok(parseFormSpec(
      { name: 'Edited', fields: [{ key: 'vendor', label: 'Vendor', type: 'text' }] },
      { existingSchema: existing() },
    ))
    expect(r.warnings.join(' ')).toMatch(/1 existing field is missing/i)
  })

  it('leaves a genuinely new field column-less for the backend to assign', () => {
    const r = ok(parseFormSpec(
      { name: 'Edited', fields: [{ key: 'brand_new', label: 'Brand New', type: 'text' }] },
      { existingSchema: existing() },
    ))
    const [el] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(el.column).toBeUndefined()
  })

  it('does nothing when creating a form (no existing schema)', () => {
    const r = ok(parseFormSpec({ name: 'New', fields: [{ key: 'vendor', label: 'Vendor', type: 'text' }] }))
    const [el] = r.form.schema.sections[0].columns.flatMap((c) => c.elements)
    expect(el.column).toBeUndefined()
    expect(r.warnings.join(' ')).not.toMatch(/missing from this spec/i)
  })
})

describe('toCompactSpec', () => {
  it('round-trips a compact spec through export and back', () => {
    const first = ok(parseFormSpec({
      name: 'Invoice',
      sections: [{
        title: 'Header',
        layout: '2',
        fields: [
          { key: 'number', label: 'Number', type: 'text', required: true, unique: true },
          { key: 'issued', label: 'Issued', type: 'date' },
        ],
      }],
    }))

    const exported = toCompactSpec(first.form)
    const second = ok(parseFormSpec(exported))

    expect(second.form.name).toBe('Invoice')
    expect(second.form.schema.sections[0].layout).toBe('2')
    const keys = second.form.schema.sections.flatMap((s) => s.columns.flatMap((c) => c.elements.map((e) => e.key)))
    // Keys must survive verbatim — a round trip that renamed them would
    // silently re-point every field at a new column.
    expect(keys).toEqual(['number', 'issued'])
    expect(projectToFields(second.form.schema).fields[0].unique).toBe(true)
  })

  it('flattens a section back into document order', () => {
    const r = ok(parseFormSpec({
      name: 'Ordered',
      sections: [{ title: 'D', layout: '2', fields: [
        { label: 'A', type: 'text' }, { label: 'B', type: 'text' }, { label: 'C', type: 'text' },
      ] }],
    }))
    expect(toCompactSpec(r.form).sections![0].fields!.map((f) => f.label)).toEqual(['A', 'C', 'B'])
  })
})

describe('compactLossReport', () => {
  it('is empty for a form the compact shape can fully express', () => {
    const r = ok(parseFormSpec({ name: 'Simple', fields: [{ label: 'A', type: 'text' }] }))
    expect(compactLossReport(r.form.schema)).toEqual([])
  })

  it('names expression rules a compact edit would drop', () => {
    const section = createSection('D', '1')
    const el = createElement('text')
    el.behavior.visibility = 'expression'
    el.behavior.visibleWhen = 'x > 1'
    section.columns[0].elements.push(el)
    const report = compactLossReport({ version: 1, sections: [section] })
    expect(report.join(' ')).toMatch(/expression-driven/i)
  })

  it('names Line Items configuration', () => {
    const section = createSection('D', '1')
    section.columns[0].elements.push(createElement('line_items'))
    expect(compactLossReport({ version: 1, sections: [section] }).join(' ')).toMatch(/line items/i)
  })
})
