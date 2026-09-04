// ---------------------------------------------------------------------------
// Heal-on-load: reconcile a stored form's layout blob with its fields[]
// ---------------------------------------------------------------------------
//
// The builder treats `layout` as the master (projection.ts DERIVES fields[]
// from it on save) and every runtime surface renders from `layout` alone.
// That works while the builder is the only writer. It breaks the moment
// anything writes fields[] through the API directly — the MCP server, the
// marketplace, curl: real Postgres columns appear with no elements to render
// them ("real columns in Postgres, nothing to see or edit in the builder",
// as form-spec.ts's own header put it), deleted fields leave ghost elements
// the next builder save would RE-CREATE, and backend-mirrored settings
// (create-user provisioning) show stale — worse, a builder save would write
// the stale value back, silently disabling provisioning that works.
//
// This module is the repair, applied at read time wherever a stored form
// becomes something visible (see resolveFormSchema in serialize.ts and
// toBuilder). The rule, in one line:
//
//   fields[] is the truth for WHAT data-bearing elements exist;
//   layout is the truth for HOW everything is arranged and presented.
//
// Concretely:
//   • a backend field with no element gets one synthesized, through the same
//     specFieldToElement/createElement factories the canvas and the JSON-spec
//     import use, appended to the last section (or a fresh "Details" section)
//   • a CONFIGURED data-bearing element whose projected field no longer
//     exists is dropped — killing the resurrection bug. Presentational
//     elements and unconfigured work-in-progress elements (a reference with
//     no target picked yet) project to nothing and are always kept
//   • settings.createUser is hydrated FROM the backend mirror columns, which
//     are what the runtime actually obeys — so the builder shows the truth
//     and a re-save round-trips it instead of clobbering it
//
// Healing is pure and idempotent: healing an already-consistent form returns
// the input unchanged (same reference), so render paths can call it every
// time without churn. Nothing is persisted here — the healed layout reaches
// the database only when the builder next saves, which is exactly when
// layout becomes authored content again.

import {
  type FormSchema, type FormSection, type FormElement, type CreateUserSettings,
  emptyFormSettings, emptyCreateUserSettings,
} from './schema'
import { createSection } from './factory'
import { specFieldToElement, type FormSpecField } from './form-spec'
import { projectedBaseName } from './projection'
import { hydrateReferenceFilter, sameReferenceFilter } from './reference-filter'
import { hydrateAccessScope, sameAccessScope } from './access-scope'
import { elementHideRules, sameFieldHideRules, reconcileHideRuleActions } from './field-hide'
import type { FieldDef, AccessScopeRule } from '@/features/forms/types'

/** The slice of a backend form definition healing needs. Structural, so
 *  callers holding a full FormDefinition or just {layout, fields} both fit. */
export interface HealableForm {
  fields?: FieldDef[]
  create_user_on_submit?: boolean
  create_user_name_field?: string
  create_user_email_field?: string
  create_user_role_field?: string
  access_scope?: AccessScopeRule[]
}

/** Field types that never get an element synthesized:
 *  - parent_link is system-managed child-form plumbing with no canvas
 *    representation at all
 *  - line_item_adopted needs adoptedFormRef/adoptedReferenceField wiring on a
 *    'line_items' element that specFieldToElement can't produce; a
 *    half-configured grid would be skipped by projection anyway, so this
 *    stays a builder job (existing adopted elements are respected either way) */
const SKIP_SYNTHESIS = new Set<string>(['parent_link', 'line_item_adopted'])

/** Where the backend FieldType vocabulary and the component alias table
 *  disagree on the right DEFAULT component. The alias table maps backend
 *  'text' to the single-line 'text' component, but a round-trip through
 *  projection would then flip the stored type text→string — so synthesis
 *  must pick the component whose projection returns the SAME backend type. */
const BACKEND_TYPE_COMPONENT_OVERRIDES: Record<string, string> = {
  text: 'textarea',
}

function fieldToSpec(f: FieldDef): FormSpecField {
  return {
    key: f.name,
    label: f.label || f.name,
    type: BACKEND_TYPE_COMPONENT_OVERRIDES[f.type] ?? f.type,
    required: f.required === true,
    unique: f.unique === true,
    description: f.description,
    options: f.enum_values,
    searchable: f.searchable === true,
    is_record_title: f.is_record_title === true,
    formRef: f.reference_table,
  }
}

/** Reconcile a parsed layout against the backend definition. Returns the
 *  input unchanged (same reference) when nothing needed healing. */
export function healSchema(parsed: FormSchema, def: HealableForm): FormSchema {
  const fields = def.fields ?? []
  const fieldByName = new Map(fields.map((f) => [f.name, f]))

  // Pass 1 — drop orphans, reconcile backend-enforced per-field settings,
  // and take stock of what the layout already covers.
  let sectionsChanged = false
  const present = new Set<string>()
  const usedKeys = new Set<string>()
  const sections: FormSection[] = parsed.sections.map((section) => {
    let changed = false
    const columns = section.columns.map((column) => {
      let colChanged = false
      const kept: FormElement[] = []
      for (const el of column.elements) {
        usedKeys.add(el.key)
        const name = projectedBaseName(el)
        if (name === null) {
          kept.push(el) // presentational, or unconfigured WIP
          continue
        }
        const f = fieldByName.get(name)
        if (!f) {
          // Projects to a field the backend no longer has: keeping it would
          // show a ghost input AND resurrect the column on the next save.
          colChanged = true
          continue
        }
        present.add(name)
        let healedEl = el
        let elChanged = false
        // reference_filter is server-ENFORCED config, so like the createUser
        // mirrors it follows the "backend is the truth" rule: an API/MCP-
        // authored (or -removed) filter is hydrated into the element, and the
        // next builder save round-trips it. Without this, a builder save
        // would project the layout's stale copy — silently REPLACING a
        // narrower filter, or resurrecting a deleted one.
        if (el.component === 'form' && !sameReferenceFilter(el.referenceFilter, f.reference_filter)) {
          healedEl = { ...healedEl, referenceFilter: f.reference_filter ? hydrateReferenceFilter(f.reference_filter) : undefined }
          elChanged = true
        }
        // hide_rules gets the identical "backend is the truth" treatment —
        // an API/MCP-authored (or -removed) audience-hide rule is adopted
        // into advancedSettings rather than clobbered by the layout's stale
        // copy on the next save, which for a masking rule would mean
        // silently UNMASKING a field. See field-hide.ts's header for why
        // this only ever touches the hidden_in_ui action, never a whole
        // Advanced Setting entry.
        if (!sameFieldHideRules(elementHideRules(el.advancedSettings), f.hide_rules)) {
          healedEl = { ...healedEl, advancedSettings: reconcileHideRuleActions(el.advancedSettings, f.hide_rules) }
          elChanged = true
        }
        if (elChanged) {
          colChanged = true
          kept.push(healedEl)
          continue
        }
        kept.push(el)
      }
      if (colChanged) {
        changed = true
        return { ...column, elements: kept }
      }
      return column
    })
    if (changed) {
      sectionsChanged = true
      return { ...section, columns }
    }
    return section
  })

  // Pass 2 — synthesize elements for fields the layout doesn't cover.
  const synthesized: FormElement[] = []
  for (const f of fields) {
    if (present.has(f.name) || SKIP_SYNTHESIS.has(f.type)) continue
    const el = specFieldToElement(fieldToSpec(f), usedKeys, [], `field "${f.name}"`)
    if (!el) continue // a type with no component mapping — leave to the builder
    // Thread physical identity and the per-type extras the compact spec
    // shape can't carry.
    if (f.column) el.column = f.column
    if (f.type === 'line_item_count') {
      el.formRef = f.reference_table
      if (f.aggregate_fn && f.aggregate_fn !== 'count') {
        el.aggregateFn = f.aggregate_fn
        el.aggregateField = f.aggregate_field
      }
    }
    if (f.type === 'reference' && f.display_field) el.displayField = f.display_field
    if (f.type === 'reference' && f.reference_filter) el.referenceFilter = hydrateReferenceFilter(f.reference_filter)
    synthesized.push(el)
  }

  let outSections = sections
  if (synthesized.length > 0) {
    sectionsChanged = true
    if (outSections.length === 0) {
      const fresh = createSection('Details', '1')
      fresh.columns[0].elements = synthesized
      outSections = [fresh]
    } else {
      // Append to the last column of the last section — plain, predictable,
      // and trivially rearrangeable in the builder afterwards.
      const last = outSections[outSections.length - 1]
      const col = last.columns[last.columns.length - 1]
      outSections = [
        ...outSections.slice(0, -1),
        {
          ...last,
          columns: [
            ...last.columns.slice(0, -1),
            { ...col, elements: [...col.elements, ...synthesized] },
          ],
        },
      ]
    }
  }

  // Pass 3 — create-user settings from the backend mirrors, which are what
  // record creation actually obeys (api/forms reads the columns, never the
  // blob). accountSectionId/viewOnlyColumns are builder bookkeeping with no
  // mirror, so whatever the layout has is kept.
  const existing = parsed.settings?.createUser
  const healedCU: CreateUserSettings = {
    ...(existing ?? emptyCreateUserSettings()),
    enabled: def.create_user_on_submit === true,
    nameFieldKey: def.create_user_name_field || undefined,
    emailFieldKey: def.create_user_email_field || undefined,
    roleFieldKey: def.create_user_role_field || undefined,
  }
  const cuChanged =
    (existing?.enabled ?? false) !== healedCU.enabled ||
    existing?.nameFieldKey !== healedCU.nameFieldKey ||
    existing?.emailFieldKey !== healedCU.emailFieldKey ||
    existing?.roleFieldKey !== healedCU.roleFieldKey

  // Pass 4 — access_scope, the same "backend-enforced setting is the truth"
  // rule as createUser and reference_filter: an API/MCP-authored (or
  // -removed) rule set is hydrated into settings, and the next builder save
  // round-trips it rather than silently replacing it with the layout's
  // stale copy — which, for a row-level security rule, means silently
  // WIDENING what a viewer can read or write.
  const asChanged = !sameAccessScope(parsed.settings?.accessScope, def.access_scope)
  const healedAS = def.access_scope ? hydrateAccessScope(def.access_scope) : undefined

  if (!sectionsChanged && !cuChanged && !asChanged) return parsed

  const settingsChanged = cuChanged || asChanged
  return {
    ...parsed,
    sections: outSections,
    settings: settingsChanged
      ? {
          ...(parsed.settings ?? emptyFormSettings()),
          ...(cuChanged ? { createUser: healedCU } : {}),
          ...(asChanged ? { accessScope: healedAS } : {}),
        }
      : (parsed.settings ?? emptyFormSettings()),
  }
}
