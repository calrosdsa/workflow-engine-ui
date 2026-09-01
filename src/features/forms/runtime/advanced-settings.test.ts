import { describe, it, expect } from 'vitest'
import { resolveAdvancedSettings, appliesToViewer, hasAdvancedSettings, NO_EFFECTS } from './advanced-settings'
import { isClientEvaluable } from '@/lib/filter-eval'
import type { CurrentViewer } from './detail-tabs/useTabVisible'
import type {
  AdvancedSetting,
  AdvancedSettingAction,
  AdvancedSettingActionType,
  AdvancedSettingGroup,
} from '@/features/form-builder/schema'

const viewer: CurrentViewer = { userId: 'u1', roleId: 'r1', permissions: [] }
const superAdmin: CurrentViewer = { userId: 'u9', roleId: 'r9', permissions: ['*'] }

let n = 0
function actions(...types: AdvancedSettingActionType[]): AdvancedSettingAction[] {
  return types.map((type) => ({ id: `a${++n}`, type }))
}
function when(field: string, op: 'eq' | 'gt', value: unknown): AdvancedSettingGroup {
  return { id: `g${++n}`, combinator: 'and', conditions: [{ id: `c${++n}`, field, op, value }], groups: [] }
}
function always(): AdvancedSettingGroup {
  return { id: `g${++n}`, combinator: 'and', conditions: [], groups: [] }
}
function rule(over: Partial<AdvancedSetting> = {}): AdvancedSetting {
  return {
    id: `s${++n}`,
    name: 'rule',
    appliesTo: 'everyone',
    when: always(),
    actions: actions('hidden_in_ui'),
    ...over,
  }
}

describe('appliesToViewer', () => {
  it('includes everyone by default', () => {
    expect(appliesToViewer(rule({ appliesTo: 'everyone' }), viewer)).toBe(true)
  })

  it('matches specific people by user id', () => {
    expect(appliesToViewer(rule({ appliesTo: 'specific_people', userIds: ['u1'] }), viewer)).toBe(true)
    expect(appliesToViewer(rule({ appliesTo: 'specific_people', userIds: ['u2'] }), viewer)).toBe(false)
    expect(appliesToViewer(rule({ appliesTo: 'specific_people' }), viewer)).toBe(false)
  })

  it('matches a specific role by role id', () => {
    expect(appliesToViewer(rule({ appliesTo: 'specific_role', roleIds: ['r1'] }), viewer)).toBe(true)
    expect(appliesToViewer(rule({ appliesTo: 'specific_role', roleIds: ['other'] }), viewer)).toBe(false)
  })

  it('does NOT give Super Admin the role bypass that isTabVisible gives', () => {
    // The inverse of the tab case: there the audience grants visibility, so a
    // '*' holder should pass. Here the audience selects who gets restricted,
    // so bypassing would make Super Admin match every role rule in the app and
    // lose access to more fields than anyone else.
    const restricted = rule({ appliesTo: 'specific_role', roleIds: ['r1'], actions: actions('hidden_in_ui') })
    expect(appliesToViewer(restricted, superAdmin)).toBe(false)
    expect(resolveAdvancedSettings([restricted], superAdmin, {})).toEqual(NO_EFFECTS)
  })

  it('ignores an unrecognised audience rather than restricting everyone', () => {
    const weird = rule({ appliesTo: 'nobody_knows' as AdvancedSetting['appliesTo'] })
    expect(appliesToViewer(weird, viewer)).toBe(false)
  })
})

describe('resolveAdvancedSettings', () => {
  it('is inert with no rules', () => {
    expect(resolveAdvancedSettings(undefined, viewer, {})).toEqual(NO_EFFECTS)
    expect(resolveAdvancedSettings([], viewer, {})).toEqual(NO_EFFECTS)
  })

  it('applies an action only when the condition matches', () => {
    const r = rule({ when: when('stage', 'eq', 'won'), actions: actions('hidden_in_ui') })
    expect(resolveAdvancedSettings([r], viewer, { stage: 'won' }).hidden).toBe(true)
    expect(resolveAdvancedSettings([r], viewer, { stage: 'lost' }).hidden).toBe(false)
  })

  it('treats an empty condition tree as always applying', () => {
    // Consistent with an empty FilterGroup compiling to `true` everywhere else
    // in this codebase: a rule with no conditions constrains nothing, so it
    // fires for everyone in its audience.
    expect(resolveAdvancedSettings([rule({ when: always() })], viewer, {}).hidden).toBe(true)
  })

  it('carries several actions from one rule', () => {
    const r = rule({ actions: actions('read_only', 'clear_value') })
    // clear_value is suppressed by read_only — see the dedicated test below.
    expect(resolveAdvancedSettings([r], viewer, {}).readOnly).toBe(true)
  })

  it('unions effects across rules', () => {
    const hide = rule({ when: when('a', 'eq', 1), actions: actions('hidden_in_ui') })
    const lock = rule({ when: when('b', 'eq', 2), actions: actions('read_only') })
    const both = resolveAdvancedSettings([hide, lock], viewer, { a: 1, b: 2 })
    expect(both.hidden).toBe(true)
    expect(both.readOnly).toBe(true)

    const onlyLock = resolveAdvancedSettings([hide, lock], viewer, { a: 0, b: 2 })
    expect(onlyLock.hidden).toBe(false)
    expect(onlyLock.readOnly).toBe(true)
  })

  it('skips rules whose audience excludes the viewer', () => {
    const other = rule({ appliesTo: 'specific_role', roleIds: ['someone-else'] })
    expect(resolveAdvancedSettings([other], viewer, {}).hidden).toBe(false)
  })

  it('evaluates conditions against live values, including numeric strings', () => {
    // The form holds "5000" as text from an <input>; the rule compares to the
    // number 1000. lib/filter-eval.ts coerces, so the rule fires.
    const r = rule({ when: when('amount', 'gt', 1000), actions: actions('read_only') })
    expect(resolveAdvancedSettings([r], viewer, { amount: '5000' }).readOnly).toBe(true)
    expect(resolveAdvancedSettings([r], viewer, { amount: '10' }).readOnly).toBe(false)
  })
})

describe('undecidable conditions leave the field alone', () => {
  it('does not restrict a field whose numeric condition has nothing to compare yet', () => {
    // The regression this pins: an untouched number input holds "", which has
    // no defined ordering against 1000, so filter-eval reports the condition
    // undecidable. An earlier draft restricted on doubt and hid the field on
    // every form before the filler had typed a character.
    const r = rule({ when: when('amount', 'gt', 1000), actions: actions('hidden_in_ui') })
    expect(resolveAdvancedSettings([r], viewer, { amount: '' }).hidden).toBe(false)
    expect(resolveAdvancedSettings([r], viewer, {}).hidden).toBe(false)
    expect(resolveAdvancedSettings([r], viewer, { amount: null }).hidden).toBe(false)

    // ...and still fires once there IS something to compare.
    expect(resolveAdvancedSettings([r], viewer, { amount: '5000' }).hidden).toBe(true)
  })

  it('does not clear a value on an undecidable condition either', () => {
    const r = rule({ when: when('amount', 'gt', 1000), actions: actions('clear_value') })
    expect(resolveAdvancedSettings([r], viewer, { amount: '' }).clearValue).toBe(false)
  })
})

describe('show_exception', () => {
  it('un-hides a field another rule hid', () => {
    // The pattern the action exists for: "hidden for everyone, except this role".
    const hideAll = rule({ appliesTo: 'everyone', actions: actions('hidden_in_ui') })
    const except = rule({ appliesTo: 'specific_role', roleIds: ['r1'], actions: actions('show_exception') })

    expect(resolveAdvancedSettings([hideAll], viewer, {}).hidden).toBe(true)
    expect(resolveAdvancedSettings([hideAll, except], viewer, {}).hidden).toBe(false)
  })

  it('does not reach a viewer outside its audience', () => {
    const hideAll = rule({ appliesTo: 'everyone', actions: actions('hidden_in_ui') })
    const except = rule({ appliesTo: 'specific_role', roleIds: ['someone-else'], actions: actions('show_exception') })
    expect(resolveAdvancedSettings([hideAll, except], viewer, {}).hidden).toBe(true)
  })

  it('does not also lift a read-only restriction', () => {
    // Deliberate: an action named "Show Exception" quietly granting write
    // access would be a surprise in the permissive direction.
    const lock = rule({ actions: actions('read_only') })
    const except = rule({ actions: actions('show_exception') })
    expect(resolveAdvancedSettings([lock, except], viewer, {}).readOnly).toBe(true)
  })

  it('applies regardless of rule order', () => {
    const hideAll = rule({ actions: actions('hidden_in_ui') })
    const except = rule({ actions: actions('show_exception') })
    expect(resolveAdvancedSettings([except, hideAll], viewer, {}).hidden).toBe(false)
    expect(resolveAdvancedSettings([hideAll, except], viewer, {}).hidden).toBe(false)
  })
})

describe('clear_value', () => {
  it('fires on a matching rule', () => {
    const r = rule({ when: when('stage', 'eq', 'lost'), actions: actions('clear_value') })
    expect(resolveAdvancedSettings([r], viewer, { stage: 'lost' }).clearValue).toBe(true)
    expect(resolveAdvancedSettings([r], viewer, { stage: 'won' }).clearValue).toBe(false)
  })

  it('is suppressed when the field is also hidden or read-only', () => {
    // Clearing a value the viewer can neither see nor edit is pointless at
    // best and silently destructive at worst.
    const hideAndClear = rule({ actions: actions('hidden_in_ui', 'clear_value') })
    expect(resolveAdvancedSettings([hideAndClear], viewer, {}).clearValue).toBe(false)

    const lockAndClear = rule({ actions: actions('read_only', 'clear_value') })
    expect(resolveAdvancedSettings([lockAndClear], viewer, {}).clearValue).toBe(false)
  })

  it('is suppressed by a hide from a DIFFERENT rule', () => {
    const clear = rule({ actions: actions('clear_value') })
    const hide = rule({ actions: actions('hidden_in_ui') })
    expect(resolveAdvancedSettings([clear, hide], viewer, {}).clearValue).toBe(false)
  })
})

describe('the client-evaluable guarantee', () => {
  it('holds for every operator the authoring UI can produce', () => {
    // AdvancedSettingCompareOp is a strict subset of CompareOp — it has no
    // `search` and no expression value mode — so every rule an admin can build
    // is decidable on the client with no round-trip. If someone widens the
    // authoring operator set past what filter-eval supports, this fails.
    const ops: AdvancedSettingGroup['conditions'][number]['op'][] = [
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'in', 'is_null', 'not_null',
    ]
    for (const op of ops) {
      const g: AdvancedSettingGroup = {
        id: 'g', combinator: 'and', conditions: [{ id: 'c', field: 'f', op, value: 'x' }], groups: [],
      }
      expect(isClientEvaluable(g), `${op} must be client-evaluable`).toBe(true)
    }
  })
})

describe('hasAdvancedSettings', () => {
  it('detects any rule at all', () => {
    expect(hasAdvancedSettings({ advancedSettings: undefined })).toBe(false)
    expect(hasAdvancedSettings({ advancedSettings: [] })).toBe(false)
    expect(hasAdvancedSettings({ advancedSettings: [rule()] })).toBe(true)
  })
})
