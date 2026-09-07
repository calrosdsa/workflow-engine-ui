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
import { projectedBaseName, staticDefaultValue } from './projection'
import { COMPONENT_REGISTRY, supportsUnique, supportsRecordTitle, supportsSearchable, supportsNumberFormat } from './component-registry'
import { hydrateReferenceFilter, sameReferenceFilter } from './reference-filter'
import { hydrateAccessScope, sameAccessScope } from './access-scope'
import { elementHideRules, sameFieldHideRules, reconcileHideRuleActions } from './field-hide'
import { elementReadOnlyRules, sameFieldReadOnlyRules, reconcileReadOnlyRuleActions } from './field-readonly'
import type { FieldDef, AccessScopeRule, NumberFormat } from '@/features/forms/types'

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

/** Order-sensitive equality for the plain string-array backend properties
 *  reconciled below (enum_values, allowed_mime_types) — both are stored and
 *  re-emitted in a fixed order, so a reorder is treated as a real change
 *  rather than shrugged off, keeping healing convergent with what the next
 *  save would actually project. */
function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// Same shallow-JSON-equality approach as sameReferenceFilter (reference-
// filter.ts) — NumberFormat is a flat, few-key object always constructed
// wholesale (by the config panel's own controls, or echoed back verbatim
// from the backend), never hand-assembled key-by-key, so stringify order
// never drifts between the two sides being compared here.
function sameNumberFormat(a: NumberFormat | undefined, b: NumberFormat | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function fieldToSpec(f: FieldDef): FormSpecField {
  return {
    key: f.name,
    label: f.label || f.name,
    type: BACKEND_TYPE_COMPONENT_OVERRIDES[f.type] ?? f.type,
    required: f.required === true,
    unique: f.unique === true,
    description: f.description,
    // Pre-built {label, value} pairs, NOT bare strings — a bare string is
    // treated by specFieldToElement's normalizeOption as an author-typed
    // label and gets slugified into a value (e.g. "Draft" -> "draft"),
    // which would silently rewrite the backend's exact enum_values strings
    // the moment this field's element is synthesized (or reconciled below).
    options: f.enum_values?.map((v) => ({ label: v, value: v })),
    searchable: f.searchable === true,
    is_record_title: f.is_record_title === true,
    number_format: f.number_format,
    formRef: f.reference_table,
    // index/default are plain backend-set column properties, routinely set
    // via the API/MCP directly (create_form/update_form) with no layout
    // element yet — carried through the same way every other field here is,
    // so a freshly synthesized element doesn't start life already missing
    // them (see the index/default reconciliation below for the companion
    // case: an element that already exists but has drifted from these).
    index: f.index === true,
    default: f.default,
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
        // Advanced Setting entry. Reads/writes healedEl.advancedSettings,
        // not el's — so it composes with the read_only_rules check right
        // below rather than clobbering it if both fired in the same pass.
        if (!sameFieldHideRules(elementHideRules(healedEl.advancedSettings), f.hide_rules)) {
          healedEl = { ...healedEl, advancedSettings: reconcileHideRuleActions(healedEl.advancedSettings, f.hide_rules) }
          elChanged = true
        }
        // read_only_rules (SEC-1) gets the identical treatment, chained
        // onto whatever the hide_rules check above already produced.
        if (!sameFieldReadOnlyRules(elementReadOnlyRules(healedEl.advancedSettings), f.read_only_rules)) {
          healedEl = { ...healedEl, advancedSettings: reconcileReadOnlyRuleActions(healedEl.advancedSettings, f.read_only_rules) }
          elChanged = true
        }
        // index/default get the identical "backend is the truth" treatment.
        // Both are plain FieldDef columns an API/MCP caller can set directly
        // on a field that ALREADY has a layout element (unlike the pass-2
        // synthesis case below, which only covers fields with no element at
        // all) — without this, a builder save touching anything else on the
        // form re-projects this element's own (unset) index/defaultValue and
        // silently wipes the API-set value, with no error surfaced anywhere.
        if (Boolean(healedEl.index) !== (f.index === true)) {
          healedEl = { ...healedEl, index: f.index === true || undefined }
          elChanged = true
        }
        if (!healedEl.behavior.dynamicDefault && staticDefaultValue(healedEl) !== (f.default ?? undefined)) {
          healedEl = { ...healedEl, defaultValue: f.default ?? undefined }
          elChanged = true
        }
        // required (NOT NULL at the DB layer) gets the identical treatment —
        // except when the element's OWN conditional-required expression
        // (requiredWhen) already governs it: elementToField can only ever
        // project `required: false` for an 'expression'-mode element (it
        // reads behavior.required === 'always' alone), so there is no
        // backend-authored `true` to adopt without destroying the
        // expression. Mirrors the dynamicDefault carve-out just above, for
        // the identical reason.
        if (healedEl.behavior.required !== 'expression') {
          const wantRequired = f.required === true ? 'always' : 'optional'
          if (healedEl.behavior.required !== wantRequired) {
            healedEl = { ...healedEl, behavior: { ...healedEl.behavior, required: wantRequired } }
            elChanged = true
          }
        }
        // unique (a real UNIQUE constraint) gets the identical treatment,
        // gated by the exact same supportsUnique/'form' check elementToField
        // itself applies before emitting it — so heal never hydrates a flag
        // a subsequent save would immediately strip again, which would
        // otherwise make this non-idempotent.
        {
          const wantUnique = f.unique === true && (supportsUnique(el.component) || el.component === 'form')
          if (Boolean(healedEl.unique) !== wantUnique) {
            healedEl = { ...healedEl, unique: wantUnique || undefined }
            elChanged = true
          }
        }
        // searchable / is_record_title get the identical treatment, each
        // gated by the same supportsX check elementToField re-applies before
        // emitting them (see that function's own comments on why: a field
        // flagged before its component type changed can't silently project a
        // stale, no-longer-valid flag).
        {
          const wantSearchable = f.searchable === true && supportsSearchable(el.component)
          if (Boolean(healedEl.searchable) !== wantSearchable) {
            healedEl = { ...healedEl, searchable: wantSearchable || undefined }
            elChanged = true
          }
        }
        {
          const wantTitle = f.is_record_title === true && supportsRecordTitle(el.component)
          if (Boolean(healedEl.isRecordTitle) !== wantTitle) {
            healedEl = { ...healedEl, isRecordTitle: wantTitle || undefined }
            elChanged = true
          }
        }
        // number_format gets the identical "backend is the truth" treatment
        // — an API/MCP-authored (or -removed) format on a field the builder
        // already has an element for would otherwise be silently reverted by
        // the layout's stale copy on the next unrelated save.
        {
          const wantFormat = supportsNumberFormat(el.component) ? f.number_format : undefined
          if (!sameNumberFormat(healedEl.numberFormat, wantFormat)) {
            healedEl = { ...healedEl, numberFormat: wantFormat }
            elChanged = true
          }
        }
        // enum_values (the CHECK constraint's value set) gets the identical
        // treatment for enum-typed elements — an option added or removed via
        // API/MCP directly on a field the builder already has an element for
        // would otherwise be silently reverted by the layout's stale options
        // list on the next unrelated save, re-narrowing the CHECK constraint
        // out from under values already written to existing records. Existing
        // labels are preserved by value; a value with no prior option (freshly
        // added on the backend) falls back to the value itself as its label,
        // same fallback fieldToSpec's own options mapping above uses.
        if (COMPONENT_REGISTRY[el.component].fieldType === 'enum') {
          const currentValues = (healedEl.options ?? []).map((o) => o.value)
          const wantValues = f.enum_values ?? []
          if (!sameStringArray(currentValues, wantValues)) {
            const byValue = new Map((healedEl.options ?? []).map((o) => [o.value, o]))
            healedEl = { ...healedEl, options: wantValues.map((v) => byValue.get(v) ?? { label: v, value: v }) }
            elChanged = true
          }
        }
        // display_field is the same kind of backend-enforced-at-read setting
        // as reference_filter above (which fields), just for what a reference
        // column displays/searches instead of the runtime's id/name/label
        // fallback — missed when index/default were added despite sitting
        // right next to reference_filter's own reconciliation.
        if (el.component === 'form') {
          const wantDisplayField = f.display_field || undefined
          if (healedEl.displayField !== wantDisplayField) {
            healedEl = { ...healedEl, displayField: wantDisplayField }
            elChanged = true
          }
        }
        // File Upload's size/type rule (FR-C1-012) gets the identical
        // treatment — these are backend-ENFORCED (api/content's Upload
        // handler is the real gate, before any bytes are stored; see
        // projection.ts's elementToField comment), so a stale/absent layout
        // value would silently WIDEN what the next save accepts — the same
        // security-relevant direction hide_rules/access_scope guard against
        // elsewhere in this file.
        if (COMPONENT_REGISTRY[el.component].fieldType === 'file') {
          const wantMaxSize = f.max_file_size_bytes || undefined
          if ((healedEl.validation.maxFileSizeBytes ?? undefined) !== wantMaxSize) {
            healedEl = { ...healedEl, validation: { ...healedEl.validation, maxFileSizeBytes: wantMaxSize } }
            elChanged = true
          }
          const wantMimeTypes = f.allowed_mime_types && f.allowed_mime_types.length > 0 ? f.allowed_mime_types : undefined
          if (!sameStringArray(healedEl.validation.allowedMimeTypes ?? [], wantMimeTypes ?? [])) {
            healedEl = { ...healedEl, validation: { ...healedEl.validation, allowedMimeTypes: wantMimeTypes } }
            elChanged = true
          }
        }
        // f.label and f.description are DELIBERATELY not reconciled here,
        // unlike everything above — they're pure display metadata with no
        // backend enforcement (no constraint, no runtime behavior hinges on
        // them), and the builder canvas is the primary place an author edits
        // either one. A drift here is cosmetic and immediately visible the
        // next time someone opens the builder, not a silently-widened
        // constraint or a silently-reverted security rule — so "layout is
        // the truth" stays correct for these two.
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
    // File Upload's backend-enforced size/type rule (FR-C1-012) — like
    // display_field/reference_filter above, FormSpecField has no slot for
    // these, so a brand-new element synthesized straight from fieldToSpec
    // would otherwise start life already missing them.
    if (f.type === 'file' && f.max_file_size_bytes) el.validation.maxFileSizeBytes = f.max_file_size_bytes
    if (f.type === 'file' && f.allowed_mime_types && f.allowed_mime_types.length > 0) el.validation.allowedMimeTypes = f.allowed_mime_types
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
