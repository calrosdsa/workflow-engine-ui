// Runtime evaluation of a field's Advanced Settings.
//
// An AdvancedSetting is a named rule on one FormElement: WHO it applies to
// (everyone / specific people / a specific role), WHEN it applies (an AND/OR
// tree over this form's own fields), and WHAT it does (hide, make read-only,
// clear the value, or grant a show-exception). The authoring UI for all of
// this already shipped — AddAdvancedSettingDialog, the condition builder, the
// per-element list — but nothing ever evaluated the result. An admin could
// configure a rule, save it, and watch it do nothing. This module is the
// missing half.
//
// A rule fires only when its condition actually matches; an undecidable
// condition (most often just an empty field) leaves the field alone — see
// resolveAdvancedSettings for why that is the correct direction here.
//
// CONDITIONS ARE EVALUATED LOCALLY, WITH NO ROUND-TRIP
// ----------------------------------------------------
// AdvancedSettingGroup is structurally identical to FilterGroup (it was forked
// only to avoid a cross-feature import — see its comment in
// form-builder/schema.ts), and AdvancedSettingCompareOp is a strict SUBSET of
// CompareOp: no `search`, no `was_updated`, and no expression value mode. That
// makes every Advanced Setting condition client-evaluable by construction, so
// lib/filter-eval.ts decides them outright — unlike behavior.visibleWhen,
// which is an Expr string and must round-trip to /expressions/validate.
//
// WHY THE SUPER-ADMIN BYPASS IS DELIBERATELY ABSENT
// -------------------------------------------------
// isTabVisible (detail-tabs/useTabVisible.ts) treats the '*' permission as
// satisfying a role gate, because there the audience GRANTS visibility and a
// Super Admin should see everything. Here the audience does the opposite: it
// selects who gets RESTRICTED. Carrying that bypass over would make a Super
// Admin match every specific_role rule in the app and lose access to more
// fields than anyone else — the exact inverse of the intent. Audience matching
// below is therefore literal, with no bypass, for every action type.
import { evaluateFilterGroup } from '@/lib/filter-eval'
import type { CurrentViewer } from './detail-tabs/useTabVisible'
import type { AdvancedSetting, FormElement } from '@/features/form-builder/schema'
import type { FilterGroup } from '@/features/workflows/types'

/** What the matching rules on one element add up to. Additive: several rules
 *  can apply at once, and any one of them asserting an effect is enough. */
export interface AdvancedFieldEffects {
  hidden: boolean
  readOnly: boolean
  /** The field's current value should be discarded. A side effect, not a
   *  render state — the caller performs it. */
  clearValue: boolean
}

export const NO_EFFECTS: AdvancedFieldEffects = { hidden: false, readOnly: false, clearValue: false }

/** Whether this rule's audience includes the viewer.
 *
 *  Literal membership only — see this file's header for why the '*' Super
 *  Admin bypass that isTabVisible applies would be actively wrong here. */
export function appliesToViewer(setting: AdvancedSetting, viewer: CurrentViewer): boolean {
  switch (setting.appliesTo) {
    case 'specific_people':
      return !!viewer.userId && !!setting.userIds?.includes(viewer.userId)
    case 'specific_role':
      return !!viewer.roleId && !!setting.roleIds?.includes(viewer.roleId)
    case 'everyone':
      return true
    default:
      // An audience this build doesn't recognise must not silently restrict
      // everyone — same never-throw, degrade-safely posture every config
      // parser here takes with an unknown stored value.
      return false
  }
}

/** Resolves every rule on one element against the viewer and the form's live
 *  values.
 *
 *  A CONDITION THAT CANNOT BE DECIDED MEANS THE RULE DOES NOT APPLY.
 *
 *  That looks like the permissive choice, and an earlier draft did the
 *  opposite — restrict on doubt, on the theory that a rule we can't read
 *  should still be respected. It was wrong, because it conflated two
 *  different things that filter-eval reports identically:
 *
 *    1. Structural undecidability — an operator or value mode the client
 *       cannot evaluate (`search`, expression values). Unreachable here:
 *       AdvancedSettingCompareOp is a strict subset of CompareOp and carries
 *       no value_mode, which advanced-settings.test.ts pins. Authoring-time
 *       validation, not a runtime guess, is the right place to catch drift.
 *    2. Value-level undecidability — an ordinary at-rest state, most often an
 *       EMPTY field: `amount > 1000` against the "" an untouched number input
 *       holds has no defined ordering.
 *
 *  Case 2 is the common one by a wide margin, and restricting on it hid a
 *  field on every form before the filler had typed anything — the rule wasn't
 *  in doubt, it simply wasn't matching yet. Since case 1 cannot occur, the
 *  policy that stays honest for case 2 is the correct one outright. */
export function resolveAdvancedSettings(
  settings: AdvancedSetting[] | undefined,
  viewer: CurrentViewer,
  values: Record<string, unknown>,
): AdvancedFieldEffects {
  if (!settings || settings.length === 0) return NO_EFFECTS

  let hidden = false
  let readOnly = false
  let clearValue = false
  let showException = false

  for (const setting of settings) {
    if (!appliesToViewer(setting, viewer)) continue
    if (!evaluateFilterGroup(setting.when as FilterGroup | undefined, { values }).matches) continue

    for (const action of setting.actions ?? []) {
      switch (action.type) {
        case 'hidden_in_ui':   hidden = true; break
        case 'read_only':      readOnly = true; break
        case 'clear_value':    clearValue = true; break
        case 'show_exception': showException = true; break
      }
    }
  }

  // "Hidden for everyone, except this role" is the pattern show_exception
  // exists for (see AdvancedSettingActionType's doc comment): one rule hides
  // the field broadly, a second grants a narrower audience an exception. It
  // un-hides only — it deliberately does not also grant write access, because
  // an action named "Show Exception" silently lifting a read-only restriction
  // would be a surprise in the permissive direction.
  if (showException) hidden = false

  // Clearing a value the viewer cannot see or edit is pointless at best and
  // silently destructive at worst.
  if (hidden || readOnly) clearValue = false

  return { hidden, readOnly, clearValue }
}

/** True when an element carries any rule at all — used to keep surfaces that
 *  deliberately opt out of dynamic behavior (InlineFieldEditor) from editing a
 *  field whose real state they haven't evaluated. */
export function hasAdvancedSettings(el: Pick<FormElement, 'advancedSettings'>): boolean {
  return (el.advancedSettings?.length ?? 0) > 0
}
