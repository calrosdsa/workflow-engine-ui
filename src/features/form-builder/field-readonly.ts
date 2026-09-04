// Round-trip helpers for FormElement.advancedSettings' 'read_only' action ↔
// FieldDef.read_only_rules — SEC-1's frontend half, mirroring field-hide.ts's
// exact shape for the 'hidden_in_ui' action. See field-hide.ts's own header
// comment for the full reasoning: one AdvancedSetting entry can carry
// SEVERAL actions at once, so deriving read_only_rules is a filter+map
// (elementReadOnlyRules) and reconciling backend changes back into
// advancedSettings must touch only the read_only ACTION, never a whole
// entry (reconcileReadOnlyRuleActions) — otherwise adopting a backend
// read_only_rules change could silently destroy a mixed entry's
// hidden_in_ui/show_exception/clear_value actions.
//
// The pure shape-conversion helpers (toFilterGroup, toAdvancedSettingGroup,
// audienceFromSetting, settingFromAudience, canonicalAudience) are imported
// from field-hide.ts rather than duplicated: nothing in them is specific to
// hidden_in_ui, since FieldReadOnlyRule shares the identical
// {audience, when} shape as FieldHideRule.

import { nanoid } from '@/features/workflows/builder/nanoid'
import type { FieldReadOnlyRule } from '@/features/forms/types'
import { type AdvancedSetting, emptyAdvancedSettingGroup } from './schema'
import { canonicalReferenceFilter } from './reference-filter'
import {
  toFilterGroup, toAdvancedSettingGroup, audienceFromSetting, settingFromAudience, canonicalAudience,
} from './field-hide'

/** Derives the backend read_only_rules an element's CURRENT advancedSettings
 *  would project to — every entry whose actions include 'read_only',
 *  regardless of what else that entry does. Used both by projection.ts (at
 *  save time) and heal.ts (to detect drift from the backend's stored copy).
 *  Mirrors elementHideRules exactly, filtering on 'read_only' instead. */
export function elementReadOnlyRules(advancedSettings: AdvancedSetting[] | undefined): FieldReadOnlyRule[] | undefined {
  const rules = (advancedSettings ?? [])
    .filter((s) => s.actions.some((a) => a.type === 'read_only'))
    .map((s): FieldReadOnlyRule => ({
      audience: audienceFromSetting(s.appliesTo, s.roleIds, s.userIds),
      when: canonicalReferenceFilter(toFilterGroup(s.when)),
    }))
  return rules.length > 0 ? rules : undefined
}

function canonicalRule(r: FieldReadOnlyRule): FieldReadOnlyRule {
  const when = canonicalReferenceFilter(r.when)
  return when ? { audience: canonicalAudience(r.audience), when } : { audience: canonicalAudience(r.audience) }
}

function canonicalRules(rules: FieldReadOnlyRule[] | undefined): FieldReadOnlyRule[] | undefined {
  if (!rules || rules.length === 0) return undefined
  return rules.map(canonicalRule)
}

/** True when two read_only_rules lists mean the same thing, ignoring UI
 *  ids, role/user id array order, and an absent-vs-empty `when`. */
export function sameFieldReadOnlyRules(a: FieldReadOnlyRule[] | undefined, b: FieldReadOnlyRule[] | undefined): boolean {
  return JSON.stringify(canonicalRules(a) ?? null) === JSON.stringify(canonicalRules(b) ?? null)
}

/** Reconciles an element's advancedSettings so its read_only-tagged rules
 *  match backendRules — touches only the read_only ACTION, never a whole
 *  entry (see this file's header). Call only after sameFieldReadOnlyRules
 *  has confirmed real drift. */
export function reconcileReadOnlyRuleActions(
  current: AdvancedSetting[] | undefined,
  backendRules: FieldReadOnlyRule[] | undefined,
): AdvancedSetting[] | undefined {
  const stripped = (current ?? [])
    .map((s) => ({ ...s, actions: s.actions.filter((a) => a.type !== 'read_only') }))
    .filter((s) => s.actions.length > 0)
  const fresh: AdvancedSetting[] = (backendRules ?? []).map((r) => {
    const { appliesTo, roleIds, userIds } = settingFromAudience(r.audience)
    return {
      id: nanoid(),
      name: 'Read-only (from API)',
      appliesTo,
      roleIds,
      userIds,
      when: r.when ? toAdvancedSettingGroup(r.when) : emptyAdvancedSettingGroup(),
      actions: [{ id: nanoid(), type: 'read_only' }],
    }
  })
  const result = [...stripped, ...fresh]
  return result.length > 0 ? result : undefined
}
