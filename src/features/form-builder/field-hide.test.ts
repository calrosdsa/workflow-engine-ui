// The hide_rules round trip: builder advancedSettings (id-ful, multi-purpose)
// ↔ backend FieldDef.hide_rules (id-less, hidden_in_ui-only). What's pinned
// here is the same anti-silent-widening property field-hide.ts's header
// describes — a builder save must emit exactly the audience-matched
// hidden_in_ui rules, and heal-on-load must adopt an API/MCP-authored rule
// set into advancedSettings so the NEXT save round-trips it instead of
// clobbering it — plus the one property reference_filter's round trip
// doesn't need to worry about: a MIXED AdvancedSetting entry (hidden_in_ui
// alongside another action) must never lose that OTHER action when its
// hidden_in_ui half gets reconciled.
import { describe, expect, it } from 'vitest'
import { elementHideRules, sameFieldHideRules, reconcileHideRuleActions } from './field-hide'
import { healSchema } from './heal'
import { projectToFields } from './projection'
import { createElement, createSection } from './factory'
import { emptySchema, emptyAdvancedSetting, emptyAdvancedSettingGroup, type FormSchema, type AdvancedSetting } from './schema'
import type { FieldDef, FieldHideRule } from '@/features/forms/types'

function schemaWith(elements: ReturnType<typeof createElement>[]): FormSchema {
  const section = createSection('Details', '1')
  section.columns[0].elements = elements
  return { version: 1, sections: [section], settings: emptySchema().settings }
}

function ssnElement(): ReturnType<typeof createElement> {
  const el = createElement('text')
  el.key = 'ssn'
  return el
}

/** A pure, single-purpose hide rule — everyone, unconditional. */
function hideEveryone(): AdvancedSetting {
  return {
    ...emptyAdvancedSetting(),
    appliesTo: 'everyone',
    actions: [{ id: 'a1', type: 'hidden_in_ui' }],
  }
}

/** A pure hide rule with a real condition. */
function hideWhenUnverified(): AdvancedSetting {
  return {
    ...emptyAdvancedSetting(),
    appliesTo: 'everyone',
    when: {
      ...emptyAdvancedSettingGroup(),
      conditions: [{ id: 'c1', field: 'verified', op: 'eq', value: false }],
    },
    actions: [{ id: 'a1', type: 'hidden_in_ui' }],
  }
}

/** A MIXED rule: hides AND makes read-only, for Sales Reps specifically. */
function mixedRoleRule(): AdvancedSetting {
  return {
    ...emptyAdvancedSetting(),
    appliesTo: 'specific_role',
    roleIds: ['sales_rep'],
    actions: [{ id: 'a1', type: 'hidden_in_ui' }, { id: 'a2', type: 'read_only' }],
  }
}

const echoedUnconditional: FieldHideRule[] = [{ audience: { type: 'everyone' } }]
// conditions deliberately lack UI ids — the backend's actual response shape.
const echoedConditional: FieldHideRule[] = [{
  audience: { type: 'everyone' },
  when: { combinator: 'and', conditions: [{ field: 'verified', op: 'eq', value: false }], groups: [] },
}] as unknown as FieldHideRule[]

describe('elementHideRules', () => {
  it('derives one rule per hidden_in_ui-tagged entry, ignoring entries with no such action', () => {
    const el = ssnElement()
    el.advancedSettings = [hideEveryone(), { ...emptyAdvancedSetting(), actions: [{ id: 'a1', type: 'read_only' }] }]
    expect(elementHideRules(el.advancedSettings)).toEqual(echoedUnconditional)
  })

  it('projects a real when condition, id-free', () => {
    const el = ssnElement()
    el.advancedSettings = [hideWhenUnverified()]
    expect(elementHideRules(el.advancedSettings)).toEqual(echoedConditional)
  })

  it('a mixed entry still contributes its hidden_in_ui half', () => {
    const el = ssnElement()
    el.advancedSettings = [mixedRoleRule()]
    expect(elementHideRules(el.advancedSettings)).toEqual([
      { audience: { type: 'specific_role', role_ids: ['sales_rep'] } },
    ])
  })

  it('returns undefined when nothing hides', () => {
    expect(elementHideRules(undefined)).toBeUndefined()
    expect(elementHideRules([])).toBeUndefined()
  })
})

describe('sameFieldHideRules', () => {
  it('treats the derived and backend-echoed shapes as equal', () => {
    expect(sameFieldHideRules(echoedUnconditional, echoedUnconditional)).toBe(true)
  })

  it('ignores role/user id array order', () => {
    const a: FieldHideRule[] = [{ audience: { type: 'specific_role', role_ids: ['r1', 'r2'] } }]
    const b: FieldHideRule[] = [{ audience: { type: 'specific_role', role_ids: ['r2', 'r1'] } }]
    expect(sameFieldHideRules(a, b)).toBe(true)
  })

  it('flags a real difference', () => {
    expect(sameFieldHideRules(echoedUnconditional, echoedConditional)).toBe(false)
    expect(sameFieldHideRules(echoedUnconditional, undefined)).toBe(false)
  })
})

describe('projection', () => {
  it('emits hide_rules for a plain hide-only entry', () => {
    const el = ssnElement()
    el.advancedSettings = [hideEveryone()]
    const [field] = projectToFields(schemaWith([el])).fields
    expect(field.hide_rules).toEqual(echoedUnconditional)
  })

  it('omits hide_rules entirely when nothing hides', () => {
    const el = ssnElement()
    const [field] = projectToFields(schemaWith([el])).fields
    expect('hide_rules' in field).toBe(false)
  })
})

describe('heal', () => {
  const backendField: FieldDef = { name: 'ssn', label: 'SSN', type: 'string', hide_rules: echoedUnconditional }

  it('adopts an API-authored rule into the element, so the next save round-trips it', () => {
    const el = ssnElement() // no advancedSettings yet -- e.g. MCP added a rule since
    const healed = healSchema(schemaWith([el]), { fields: [backendField] })
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(sameFieldHideRules(elementHideRules(healedEl.advancedSettings), echoedUnconditional)).toBe(true)
    expect(projectToFields(healed).fields[0].hide_rules).toEqual(echoedUnconditional)
  })

  it('adopts an API-side REMOVAL too, instead of resurrecting the layout copy', () => {
    const el = ssnElement()
    el.advancedSettings = [hideEveryone()]
    const healed = healSchema(schemaWith([el]), { fields: [{ ...backendField, hide_rules: undefined }] })
    const projected = projectToFields(healed).fields[0]
    expect('hide_rules' in projected).toBe(false)
  })

  it('is identity-stable when the two copies already agree', () => {
    const el = ssnElement()
    el.advancedSettings = [hideEveryone()]
    const schema = schemaWith([el])
    const healed = healSchema(schema, { fields: [backendField] })
    expect(healed).toBe(schema)
  })

  it('reconciling a MIXED rule strips only the hidden_in_ui action, keeping read_only intact', () => {
    const el = ssnElement()
    el.advancedSettings = [mixedRoleRule()] // hides+read-only for sales_rep
    // Backend now says: no hide rule for sales_rep, but DOES hide from
    // everyone -- and, since SEC-1, ALSO confirms the mixed entry's
    // read_only half really is backend-tracked (its own heal reconciliation
    // runs too; omitting read_only_rules here would make IT the one with
    // drift to fix, stripping read_only instead -- this field's mixed entry
    // has a matching rule on both sides, so neither reconciliation touches
    // the other's action).
    const healed = healSchema(schemaWith([el]), {
      fields: [{ ...backendField, read_only_rules: [{ audience: { type: 'specific_role', role_ids: ['sales_rep'] } }] }],
    })
    const healedEl = healed.sections[0].columns[0].elements[0]
    const settings = healedEl.advancedSettings ?? []

    // The original mixed entry survives with read_only intact, hidden_in_ui gone.
    const survivor = settings.find((s) => s.actions.some((a) => a.type === 'read_only'))
    expect(survivor).toBeDefined()
    expect(survivor!.actions.some((a) => a.type === 'hidden_in_ui')).toBe(false)

    // A fresh, separate entry now carries the backend's actual hide rule.
    expect(sameFieldHideRules(elementHideRules(settings), echoedUnconditional)).toBe(true)
    expect(projectToFields(healed).fields[0].hide_rules).toEqual(echoedUnconditional)
  })
})

describe('reconcileHideRuleActions', () => {
  it('drops an entry left with zero actions after stripping hidden_in_ui', () => {
    const pureHide = hideEveryone() // only action is hidden_in_ui
    const result = reconcileHideRuleActions([pureHide], undefined) // backend says: no rules
    expect(result).toBeUndefined()
  })
})
