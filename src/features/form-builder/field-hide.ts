// Round-trip helpers for FormElement.advancedSettings' 'hidden_in_ui' action
// ↔ FieldDef.hide_rules.
//
// This is NOT a plain "strip UI ids" round-trip like reference-filter.ts's:
// hide_rules is a NARROW PROJECTION of advancedSettings, not a mirror of it.
// One AdvancedSetting entry can carry SEVERAL actions at once (hidden_in_ui
// alongside read_only/show_exception/clear_value — see AddAdvancedSettingDialog),
// and the backend has no concept of the other three at all. So deriving
// hide_rules from advancedSettings is a filter+map (elementHideRules), but
// reconciling the OTHER direction — an API/MCP-authored change to hide_rules
// adopted back into the layout, the same "backend is the truth" rule
// access-scope.ts and reference-filter.ts already follow — can't just
// overwrite the element's advancedSettings wholesale without destroying any
// read_only/show_exception/clear_value action living in the same entries.
//
// reconcileHideRuleActions resolves this by only ever touching the
// hidden_in_ui ACTION, never a whole entry: it strips hidden_in_ui out of
// every existing entry (dropping any entry left with zero actions — a rule
// that does nothing), then appends one fresh, single-purpose entry per
// current backend rule. Lossless for the common case (a pure hide-only
// entry — everything the UI's simplest flow and EVERY MCP-authored rule
// produce, since MCP's typed surface can't express the other three actions
// at all) — it round-trips byte-for-byte, because sameFieldHideRules only
// flags real drift, so this reconciliation only ever runs when something
// actually changed. A hand-authored MIXED rule (hidden_in_ui + read_only in
// one entry) loses its hidden_in_ui action here and gets hidden by a
// separate synthesized entry instead — never silently dropped, just split
// into two entries with the same combined effect.

import { nanoid } from '@/features/workflows/builder/nanoid'
import type { FilterGroup } from '@/features/workflows/types'
import type { FieldHideAudience, FieldHideRule } from '@/features/forms/types'
import {
  type AdvancedSetting, type AdvancedSettingAudience, type AdvancedSettingGroup,
  emptyAdvancedSettingGroup,
} from './schema'
import { canonicalReferenceFilter } from './reference-filter'

// Exported for field-readonly.ts's reuse — these four are pure shape
// conversions with nothing hidden_in_ui-specific in them (audience/when
// structure is identical between hide_rules and read_only_rules).
export function toFilterGroup(when: AdvancedSettingGroup): FilterGroup {
  return {
    combinator: when.combinator === 'or' ? 'or' : 'and',
    // id is FilterCondition's UI-only key — canonicalReferenceFilter strips
    // it right back out, so a throwaway value satisfies the type without
    // meaning anything.
    conditions: when.conditions.map((c) => ({ id: c.id, field: c.field, op: c.op, value: c.value })),
    groups: (when.groups ?? []).map(toFilterGroup),
  }
}

// The reverse of toFilterGroup, for hydrating a backend-echoed `when` back
// into the shape the condition builder needs (UI ids, AdvancedSettingGroup's
// narrower op union — safe by construction, since a saved hide_rules `when`
// can only ever hold ops field.fieldHideAllowedOps accepted at save time).
export function toAdvancedSettingGroup(g: FilterGroup): AdvancedSettingGroup {
  return {
    id: nanoid(),
    combinator: g.combinator === 'or' ? 'or' : 'and',
    conditions: g.conditions.map((c) => ({
      id: nanoid(),
      field: c.field,
      op: c.op as AdvancedSettingGroup['conditions'][number]['op'],
      value: c.value,
    })),
    groups: (g.groups ?? []).map(toAdvancedSettingGroup),
  }
}

export function audienceFromSetting(appliesTo: AdvancedSettingAudience, roleIds?: string[], userIds?: string[]): FieldHideAudience {
  switch (appliesTo) {
    case 'specific_role':
      return { type: 'specific_role', role_ids: roleIds ?? [] }
    case 'specific_people':
      return { type: 'specific_people', user_ids: userIds ?? [] }
    default:
      return { type: 'everyone' }
  }
}

export function settingFromAudience(a: FieldHideAudience): { appliesTo: AdvancedSettingAudience; roleIds?: string[]; userIds?: string[] } {
  switch (a.type) {
    case 'specific_role':
      return { appliesTo: 'specific_role', roleIds: a.role_ids ?? [] }
    case 'specific_people':
      return { appliesTo: 'specific_people', userIds: a.user_ids ?? [] }
    default:
      return { appliesTo: 'everyone' }
  }
}

/** Derives the backend hide_rules an element's CURRENT advancedSettings
 *  would project to — every entry whose actions include 'hidden_in_ui',
 *  regardless of what else that entry does. Used both by projection.ts (at
 *  save time, the real projection) and heal.ts (to detect drift from the
 *  backend's stored copy). */
export function elementHideRules(advancedSettings: AdvancedSetting[] | undefined): FieldHideRule[] | undefined {
  const rules = (advancedSettings ?? [])
    .filter((s) => s.actions.some((a) => a.type === 'hidden_in_ui'))
    .map((s): FieldHideRule => ({
      audience: audienceFromSetting(s.appliesTo, s.roleIds, s.userIds),
      when: canonicalReferenceFilter(toFilterGroup(s.when)),
    }))
  return rules.length > 0 ? rules : undefined
}

export function canonicalAudience(a: FieldHideAudience): FieldHideAudience {
  switch (a.type) {
    case 'specific_role':
      return { type: 'specific_role', role_ids: [...(a.role_ids ?? [])].sort() }
    case 'specific_people':
      return { type: 'specific_people', user_ids: [...(a.user_ids ?? [])].sort() }
    default:
      return { type: 'everyone' }
  }
}

function canonicalRule(r: FieldHideRule): FieldHideRule {
  const when = canonicalReferenceFilter(r.when)
  return when ? { audience: canonicalAudience(r.audience), when } : { audience: canonicalAudience(r.audience) }
}

function canonicalRules(rules: FieldHideRule[] | undefined): FieldHideRule[] | undefined {
  if (!rules || rules.length === 0) return undefined
  return rules.map(canonicalRule)
}

/** True when two hide_rules lists mean the same thing, ignoring UI ids,
 *  role/user id array order, and an absent-vs-empty `when`. */
export function sameFieldHideRules(a: FieldHideRule[] | undefined, b: FieldHideRule[] | undefined): boolean {
  return JSON.stringify(canonicalRules(a) ?? null) === JSON.stringify(canonicalRules(b) ?? null)
}

/** Reconciles an element's advancedSettings so its hidden_in_ui-tagged
 *  rules match backendRules — see this file's header for why this touches
 *  only the hidden_in_ui action, never a whole entry. Call only after
 *  sameFieldHideRules has confirmed real drift; calling it unconditionally
 *  would regenerate fresh ids on every load even when nothing changed. */
export function reconcileHideRuleActions(
  current: AdvancedSetting[] | undefined,
  backendRules: FieldHideRule[] | undefined,
): AdvancedSetting[] | undefined {
  const stripped = (current ?? [])
    .map((s) => ({ ...s, actions: s.actions.filter((a) => a.type !== 'hidden_in_ui') }))
    .filter((s) => s.actions.length > 0)
  const fresh: AdvancedSetting[] = (backendRules ?? []).map((r) => {
    const { appliesTo, roleIds, userIds } = settingFromAudience(r.audience)
    return {
      id: nanoid(),
      name: 'Hidden (from API)',
      appliesTo,
      roleIds,
      userIds,
      when: r.when ? toAdvancedSettingGroup(r.when) : emptyAdvancedSettingGroup(),
      actions: [{ id: nanoid(), type: 'hidden_in_ui' }],
    }
  })
  const result = [...stripped, ...fresh]
  return result.length > 0 ? result : undefined
}
