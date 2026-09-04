// The read_only_rules round trip: builder advancedSettings (id-ful,
// multi-purpose) ↔ backend FieldDef.read_only_rules (id-less,
// read_only-only). Mirrors field-hide.test.ts's exact structure and the
// same anti-silent-widening property (a builder save must emit exactly the
// audience-matched read_only rules; heal-on-load must adopt an API/MCP-
// authored rule set so the next save round-trips it) plus the identical
// mixed-entry-preservation property.
//
// Also covers the one thing NEW here that field-hide.test.ts's own suite
// couldn't: hide_rules and read_only_rules are two independent
// reconciliations that both touch the same element.advancedSettings during
// heal — see heal.ts's comment on why each reads the OTHER's output rather
// than the stale original.
import { describe, expect, it } from 'vitest'
import { elementReadOnlyRules, sameFieldReadOnlyRules, reconcileReadOnlyRuleActions } from './field-readonly'
import { elementHideRules, sameFieldHideRules } from './field-hide'
import { healSchema } from './heal'
import { projectToFields } from './projection'
import { createElement, createSection } from './factory'
import { emptySchema, emptyAdvancedSetting, emptyAdvancedSettingGroup, type FormSchema, type AdvancedSetting } from './schema'
import type { FieldDef, FieldReadOnlyRule } from '@/features/forms/types'

function schemaWith(elements: ReturnType<typeof createElement>[]): FormSchema {
  const section = createSection('Details', '1')
  section.columns[0].elements = elements
  return { version: 1, sections: [section], settings: emptySchema().settings }
}

function statusElement(): ReturnType<typeof createElement> {
  const el = createElement('text')
  el.key = 'status'
  return el
}

/** A pure, single-purpose read-only rule — everyone, unconditional. */
function lockEveryone(): AdvancedSetting {
  return {
    ...emptyAdvancedSetting(),
    appliesTo: 'everyone',
    actions: [{ id: 'a1', type: 'read_only' }],
  }
}

/** A pure read-only rule with a real condition. */
function lockWhenApproved(): AdvancedSetting {
  return {
    ...emptyAdvancedSetting(),
    appliesTo: 'everyone',
    when: {
      ...emptyAdvancedSettingGroup(),
      conditions: [{ id: 'c1', field: 'approved', op: 'eq', value: true }],
    },
    actions: [{ id: 'a1', type: 'read_only' }],
  }
}

/** A MIXED rule: hides AND locks, for Sales Reps specifically. */
function mixedRoleRule(): AdvancedSetting {
  return {
    ...emptyAdvancedSetting(),
    appliesTo: 'specific_role',
    roleIds: ['sales_rep'],
    actions: [{ id: 'a1', type: 'hidden_in_ui' }, { id: 'a2', type: 'read_only' }],
  }
}

const echoedUnconditional: FieldReadOnlyRule[] = [{ audience: { type: 'everyone' } }]
const echoedConditional: FieldReadOnlyRule[] = [{
  audience: { type: 'everyone' },
  when: { combinator: 'and', conditions: [{ field: 'approved', op: 'eq', value: true }], groups: [] },
}] as unknown as FieldReadOnlyRule[]

describe('elementReadOnlyRules', () => {
  it('derives one rule per read_only-tagged entry, ignoring entries with no such action', () => {
    const el = statusElement()
    el.advancedSettings = [lockEveryone(), { ...emptyAdvancedSetting(), actions: [{ id: 'a1', type: 'hidden_in_ui' }] }]
    expect(elementReadOnlyRules(el.advancedSettings)).toEqual(echoedUnconditional)
  })

  it('projects a real when condition, id-free', () => {
    const el = statusElement()
    el.advancedSettings = [lockWhenApproved()]
    expect(elementReadOnlyRules(el.advancedSettings)).toEqual(echoedConditional)
  })

  it('a mixed entry still contributes its read_only half', () => {
    const el = statusElement()
    el.advancedSettings = [mixedRoleRule()]
    expect(elementReadOnlyRules(el.advancedSettings)).toEqual([
      { audience: { type: 'specific_role', role_ids: ['sales_rep'] } },
    ])
  })

  it('returns undefined when nothing locks', () => {
    expect(elementReadOnlyRules(undefined)).toBeUndefined()
    expect(elementReadOnlyRules([])).toBeUndefined()
  })
})

describe('sameFieldReadOnlyRules', () => {
  it('treats the derived and backend-echoed shapes as equal', () => {
    expect(sameFieldReadOnlyRules(echoedUnconditional, echoedUnconditional)).toBe(true)
  })

  it('ignores role/user id array order', () => {
    const a: FieldReadOnlyRule[] = [{ audience: { type: 'specific_role', role_ids: ['r1', 'r2'] } }]
    const b: FieldReadOnlyRule[] = [{ audience: { type: 'specific_role', role_ids: ['r2', 'r1'] } }]
    expect(sameFieldReadOnlyRules(a, b)).toBe(true)
  })

  it('flags a real difference', () => {
    expect(sameFieldReadOnlyRules(echoedUnconditional, echoedConditional)).toBe(false)
    expect(sameFieldReadOnlyRules(echoedUnconditional, undefined)).toBe(false)
  })
})

describe('projection', () => {
  it('emits read_only_rules for a plain lock-only entry', () => {
    const el = statusElement()
    el.advancedSettings = [lockEveryone()]
    const [field] = projectToFields(schemaWith([el])).fields
    expect(field.read_only_rules).toEqual(echoedUnconditional)
  })

  it('omits read_only_rules entirely when nothing locks', () => {
    const el = statusElement()
    const [field] = projectToFields(schemaWith([el])).fields
    expect('read_only_rules' in field).toBe(false)
  })
})

describe('heal', () => {
  const backendField: FieldDef = { name: 'status', label: 'Status', type: 'string', read_only_rules: echoedUnconditional }

  it('adopts an API-authored rule into the element, so the next save round-trips it', () => {
    const el = statusElement() // no advancedSettings yet -- e.g. MCP added a rule since
    const healed = healSchema(schemaWith([el]), { fields: [backendField] })
    const healedEl = healed.sections[0].columns[0].elements[0]
    expect(sameFieldReadOnlyRules(elementReadOnlyRules(healedEl.advancedSettings), echoedUnconditional)).toBe(true)
    expect(projectToFields(healed).fields[0].read_only_rules).toEqual(echoedUnconditional)
  })

  it('adopts an API-side REMOVAL too, instead of resurrecting the layout copy', () => {
    const el = statusElement()
    el.advancedSettings = [lockEveryone()]
    const healed = healSchema(schemaWith([el]), { fields: [{ ...backendField, read_only_rules: undefined }] })
    const projected = projectToFields(healed).fields[0]
    expect('read_only_rules' in projected).toBe(false)
  })

  it('is identity-stable when the two copies already agree', () => {
    const el = statusElement()
    el.advancedSettings = [lockEveryone()]
    const schema = schemaWith([el])
    const healed = healSchema(schema, { fields: [backendField] })
    expect(healed).toBe(schema)
  })

  it('reconciling a MIXED rule strips only the read_only action, keeping hidden_in_ui intact', () => {
    const el = statusElement()
    el.advancedSettings = [mixedRoleRule()] // hides+locks for sales_rep
    // Backend now says: no read_only rule for sales_rep, but DOES lock from
    // everyone -- and ALSO confirms the mixed entry's hidden_in_ui half is
    // backend-tracked too, so that reconciliation has no drift to fix
    // either (mirrors field-hide.test.ts's identical fixture note).
    const healed = healSchema(schemaWith([el]), {
      fields: [{ ...backendField, hide_rules: [{ audience: { type: 'specific_role', role_ids: ['sales_rep'] } }] }],
    })
    const healedEl = healed.sections[0].columns[0].elements[0]
    const settings = healedEl.advancedSettings ?? []

    // The original mixed entry survives with hidden_in_ui intact, read_only gone.
    const survivor = settings.find((s) => s.actions.some((a) => a.type === 'hidden_in_ui'))
    expect(survivor).toBeDefined()
    expect(survivor!.actions.some((a) => a.type === 'read_only')).toBe(false)

    // A fresh, separate entry now carries the backend's actual read_only rule.
    expect(sameFieldReadOnlyRules(elementReadOnlyRules(settings), echoedUnconditional)).toBe(true)
    expect(projectToFields(healed).fields[0].read_only_rules).toEqual(echoedUnconditional)
  })

  // The property field-hide.test.ts's own suite can't exercise on its own:
  // hide_rules and read_only_rules are two SEPARATE reconciliations that
  // both write element.advancedSettings during the same heal pass. If the
  // second one read the stale pre-heal advancedSettings instead of the
  // first's output, one change would silently clobber the other.
  it('adopts a simultaneous hide_rules AND read_only_rules change without either clobbering the other', () => {
    const el = statusElement() // no advancedSettings yet
    const backendFieldBoth: FieldDef = {
      name: 'status', label: 'Status', type: 'string',
      hide_rules: [{ audience: { type: 'specific_role', role_ids: ['sales_rep'] } }],
      read_only_rules: echoedUnconditional,
    }
    const healed = healSchema(schemaWith([el]), { fields: [backendFieldBoth] })
    const healedEl = healed.sections[0].columns[0].elements[0]

    expect(sameFieldHideRules(
      elementHideRules(healedEl.advancedSettings),
      [{ audience: { type: 'specific_role', role_ids: ['sales_rep'] } }],
    )).toBe(true)
    expect(sameFieldReadOnlyRules(elementReadOnlyRules(healedEl.advancedSettings), echoedUnconditional)).toBe(true)

    const projected = projectToFields(healed).fields[0]
    expect(projected.hide_rules).toEqual([{ audience: { type: 'specific_role', role_ids: ['sales_rep'] } }])
    expect(projected.read_only_rules).toEqual(echoedUnconditional)
  })
})

describe('reconcileReadOnlyRuleActions', () => {
  it('drops an entry left with zero actions after stripping read_only', () => {
    const pureLock = lockEveryone() // only action is read_only
    const result = reconcileReadOnlyRuleActions([pureLock], undefined) // backend says: no rules
    expect(result).toBeUndefined()
  })
})
