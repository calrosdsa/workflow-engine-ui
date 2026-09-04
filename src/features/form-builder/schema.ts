// ---------------------------------------------------------------------------
// Form Builder schema
// ---------------------------------------------------------------------------
//
// This is the rich, UI-owned schema for the visual form designer. It is stored
// verbatim in the backend's `layout` JSONB column (opaque to the backend) and
// round-trips losslessly. On save, the data-bearing elements are ALSO projected
// down to the backend's flat `FieldDef[]` for SQL table generation (see
// `projectToFields` in ./projection.ts).
//
// Hierarchy:  FormSchema → Section[] → Column[] → FormElement[]
//
// Adding a new component type only requires: (1) a `ComponentType` entry,
// (2) a registry entry in ./component-registry.ts, (3) optionally a renderer
// case in ./elements/ElementPreview.tsx and a backend type mapping in
// ./projection.ts. Nothing else needs to change.

// ---------------------------------------------------------------------------
// Component types
// ---------------------------------------------------------------------------

import type { ConfigSchema } from '@/lib/config-schema'
import type { UiWorkflow } from '@/features/ui-workflows/types'
import type { FieldChangeWorkflowConfig } from '@/features/ui-workflows/useFieldChangeWorkflow'
import type { FilterGroup } from '@/features/workflows/types'
import type { AccessScopeRule } from '@/features/forms/types'

export type ComponentType =
  // Text inputs
  | 'text' | 'textarea' | 'number' | 'email' | 'password' | 'phone' | 'url'
  // Date/time
  | 'date' | 'time' | 'datetime'
  // Choice
  | 'checkbox' | 'switch' | 'radio' | 'select' | 'multiselect' | 'autocomplete' | 'role'
  // Relational
  | 'form' | 'line_items' | 'line_item_count'
  // Files
  | 'file' | 'image'
  // Rich / presentational
  | 'richtext' | 'divider' | 'heading' | 'paragraph' | 'spacer' | 'hidden'

/** Categories used to group the toolbox. */
export type ComponentCategory = 'Input' | 'Choice' | 'DateTime' | 'Media' | 'Layout'

// ---------------------------------------------------------------------------
// Expression-or-static rule
// ---------------------------------------------------------------------------

/** Visibility behaviour for a field. */
export type VisibilityMode = 'always' | 'hidden' | 'expression'
/** Required behaviour for a field. */
export type RequiredMode = 'always' | 'optional' | 'expression'
/** Read-only behaviour for a field. */
export type ReadOnlyMode = 'editable' | 'always' | 'expression'

// ---------------------------------------------------------------------------
// Per-element configuration
// ---------------------------------------------------------------------------

export interface SelectOption {
  label: string
  value: string
}

export interface ElementValidation {
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string          // regex
  customMessage?: string
  // 'file'/'image' only (FR-C1-012) — maps to backend FieldDef's
  // MaxFileSizeBytes/AllowedMimeTypes (internal/forms/field/types.go).
  // maxFileSizeBytes stores bytes even though the config panel's own input
  // is authored in MB, matching the backend's own unit — conversion happens
  // at the UI boundary (ConfigPanel), not here.
  maxFileSizeBytes?: number
  allowedMimeTypes?: string[]
}

export interface ElementBehavior {
  visibility: VisibilityMode
  visibleWhen?: string      // expression (when visibility === 'expression')
  required: RequiredMode
  requiredWhen?: string     // expression
  readOnly: ReadOnlyMode
  readOnlyWhen?: string     // expression
  disabled?: boolean
  dynamicDefault?: string   // expression producing the default value
}

export interface ElementAppearance {
  width?: 'full' | 'half' | 'third' | 'quarter' | 'auto'
  colSpan?: number          // responsive column span (1..12)
  cssClass?: string
  tooltip?: string
  prefix?: string
  suffix?: string
  icon?: string             // lucide icon name
}

/** Where a field's value/options come from. */
export type BindingSource = 'none' | 'form_field' | 'workflow_variable' | 'expression' | 'option_source'

export interface ElementBinding {
  source: BindingSource
  // form_field / workflow_variable → the referenced name
  ref?: string
  // expression → computed value
  expression?: string
  // option_source → a named dynamic source (future API-backed)
  optionSource?: string
}

// ---------------------------------------------------------------------------
// Line Items ('line_items' component)
// ---------------------------------------------------------------------------

/** A Line Items grid's row-editor fields are authored the SAME way the main
 *  canvas is — sections of columns of FormElements — not a flat list. This
 *  is what lets the row-editor sidebar lay fields out multi-column, exactly
 *  like FormRenderer does for a normal form, instead of always stacking one
 *  field per row. The summary TABLE (grid headers/cells) still flattens
 *  this back into document order — a table has no room for section
 *  columns — see LineItemsGrid's flattenLineItemSections. */
export type LineItemSection = FormSection

/** Component types excluded from a Line Items row: 'line_item_count' (a row
 *  can't meaningfully hold a count of some other grid — that concept only
 *  makes sense on the PARENT form). Everything else, including 'line_items'
 *  itself (nested grids, recursively, no depth limit), is allowed. */
export type LineItemColumnComponent = Exclude<ComponentType, 'line_item_count'>

/** Which aggregate a 'line_item_count' element computes over its target
 *  grid's rows — same string values as the backend's field.LineItemAggregateFn
 *  so they round-trip through FieldDef.aggregate_fn with no translation. */
export type LineItemAggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max'

/** Layout/Behavior configuration for a Line Items field, set in the Config
 *  Panel and stored verbatim in the parent's `layout` (opaque to the backend). */
export interface LineItemsConfig {
  // Layout
  /** Undefined/'table' is the original, only-ever-existed layout (a plain
   *  summary table). 'cards' renders each row as a stacked label/value card
   *  instead — meant for narrow/mobile viewports where a wide table with
   *  many columns has to horizontal-scroll. Table-only settings below
   *  (stickyHeader, alternateRowColors, tableHeight) are ignored in cards
   *  mode — there's no header row or fixed height concept for a card list. */
  displayMode?: 'table' | 'cards'
  tableHeight?: number       // px; undefined = auto/grow
  allowResize?: boolean
  stickyHeader?: boolean
  alternateRowColors?: boolean
  compactMode?: boolean
  // Behavior
  allowAddRows?: boolean
  allowDeleteRows?: boolean
  allowDuplicateRows?: boolean
  allowReorderRows?: boolean
  minRows?: number
  maxRows?: number
  defaultRows?: number
  /** Undefined/'sidebar' is the original, only-ever-existed editing mode (a
   *  slide-over Drawer with the full row's fields). 'inline' instead renders
   *  each column as a live editable input directly in the table cell / card
   *  field — no separate "open the row" step, changes apply immediately.
   *  Only meaningful in 'table'/'cards' displayMode; a column that is ITSELF
   *  a nested Line Items grid can never render inline (no room for a grid
   *  inside a table cell) and always falls back to opening the sidebar for
   *  that one column, regardless of this setting. */
  rowEditMode?: 'sidebar' | 'inline'
}

export function emptyLineItemsConfig(): LineItemsConfig {
  return {
    allowResize: true,
    stickyHeader: true,
    alternateRowColors: true,
    compactMode: false,
    allowAddRows: true,
    allowDeleteRows: true,
    allowDuplicateRows: true,
    allowReorderRows: true,
  }
}

// ---------------------------------------------------------------------------
// Advanced Settings (per-element rule-based overrides)
// ---------------------------------------------------------------------------
//
// A named, targetable, conditional rule attached to a single FormElement.
// Unlike ElementBehavior's single expression-string rules (visibleWhen etc,
// evaluated for every filler), an AdvancedSetting is scoped to WHO it
// applies to (everyone / specific people / a specific role) and WHEN it
// applies (an AND/OR condition tree over this form's own fields), and can
// carry more than one action at once (e.g. hide AND clear the value).

/** Who an AdvancedSetting's actions apply to. */
export type AdvancedSettingAudience = 'everyone' | 'specific_people' | 'specific_role'

export type AdvancedSettingCompareOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'in' | 'is_null' | 'not_null'

/** A single leaf condition: `<field> <op> <value>`, compared against this
 *  form's own field values at fill time. */
export interface AdvancedSettingCondition {
  id: string                // UI-only key for list rendering (stripped on save)
  field: string              // this form's own field key
  op: AdvancedSettingCompareOp
  value?: unknown
}

/** A group of conditions/nested groups joined by AND/OR — mirrors the
 *  workflow FilterBuilder's FilterGroup shape, kept as a separate,
 *  form-builder-local type since FilterGroup lives in features/workflows
 *  and is wired to workflow-specific node context/expressions. */
export interface AdvancedSettingGroup {
  id: string                 // UI-only key (stripped on save)
  combinator: 'and' | 'or'
  conditions: AdvancedSettingCondition[]
  groups: AdvancedSettingGroup[]
}

/** What kind of action an AdvancedSetting performs when its conditions
 *  match. `show_exception` inverts the audience's normal restriction (e.g.
 *  "hidden for everyone, except this role") — kept as a distinct action
 *  rather than a modifier on the others so the UI/list stays uniform. */
export type AdvancedSettingActionType = 'hidden_in_ui' | 'read_only' | 'show_exception' | 'clear_value'

export interface AdvancedSettingAction {
  id: string                 // UI-only key for list rendering (stripped on save)
  type: AdvancedSettingActionType
}

/** One named Advanced Setting entry, as configured via the "Add new
 *  Advanced Settings" modal. Stored per-element (FormElement.advancedSettings). */
export interface AdvancedSetting {
  id: string
  name: string
  appliesTo: AdvancedSettingAudience
  /** User ids — set when appliesTo === 'specific_people'. */
  userIds?: string[]
  /** Role ids — set when appliesTo === 'specific_role'. */
  roleIds?: string[]
  when: AdvancedSettingGroup
  actions: AdvancedSettingAction[]
}

export function emptyAdvancedSettingGroup(): AdvancedSettingGroup {
  return { id: newAdvancedSettingId(), combinator: 'and', conditions: [], groups: [] }
}

export function emptyAdvancedSetting(): AdvancedSetting {
  return {
    id: newAdvancedSettingId(),
    name: '',
    appliesTo: 'everyone',
    when: emptyAdvancedSettingGroup(),
    actions: [],
  }
}

export function newAdvancedSettingCondition(): AdvancedSettingCondition {
  return { id: newAdvancedSettingId(), field: '', op: 'eq', value: '' }
}

// Tiny collision-resistant id generator, mirroring the one used by the
// workflow FilterBuilder — avoids importing across the workflows feature
// boundary for a single-purpose UI key.
function newAdvancedSettingId(len = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  arr.forEach((b) => (id += chars[b % chars.length]))
  return id
}

// ---------------------------------------------------------------------------
// Form-level settings ("Additional Form Settings" panel)
// ---------------------------------------------------------------------------

/** A single read-only status column shown once "Create User" is on. Modeled
 *  as a list (not a single hardcoded field) so more view-only columns can be
 *  added later without another schema shape change — e.g. a future
 *  "Account Status" alongside "Invitation Status". */
export interface ViewOnlyColumn {
  id: string      // stable key, e.g. 'invitation_status'
  label: string   // display label, e.g. 'Invitation Status'
}

/** "Do you want to create a user with each {Form Name} enrollment?" and its
 *  conditional sub-fields. Lives on FormSchema.settings, sibling to
 *  LineItemsConfig's per-element pattern but scoped to the whole form.
 *
 *  Enabling this injects a real "Account" section (Name/Email/Role fields)
 *  onto the canvas — see createAccountSection() in factory.ts and
 *  insertAccountSection()/removeAccountSection() in store.ts. The fields
 *  below track that injected section/fields by id/key rather than letting
 *  a builder user point them at arbitrary existing fields, since runtime
 *  provisioning depends on these keys resolving inside the tracked section. */
export interface CreateUserSettings {
  enabled: boolean
  /** Id of the injected "Account" FormSection, so toggling off can find and
   *  remove precisely that section. */
  accountSectionId?: string
  /** Key of the injected Name FormElement. */
  nameFieldKey?: string
  /** Key of the injected Email FormElement (component === 'email'). */
  emailFieldKey?: string
  /** Key of the injected Role FormElement (component === 'role'). */
  roleFieldKey?: string
  /** Which read-only status columns to surface. Defaults to just
   *  Invitation Status; extensible for future columns. */
  viewOnlyColumns: ViewOnlyColumn[]
}

/** Which named layout template a form's record-detail page uses (Detail
 *  Page Builder) — mirrors ColumnLayout/COLUMN_LAYOUTS' "small fixed set of
 *  named templates" pattern rather than a freeform zone editor. 'single'
 *  (the implicit default — see FormSettings.detailLayout) has exactly one
 *  zone; every tab/field predating this feature has no `zone` set and
 *  lands there unchanged. The two sidebar templates add a second, narrower
 *  zone, differing only in which side it renders on. */
export type DetailPageLayoutId = 'single' | 'main-right-sidebar' | 'main-left-sidebar'

/** Which direction the record-detail page's TOP-LEVEL tab bar renders in.
 *  Absent means 'horizontal' — every form's behavior before this setting
 *  existed. Applies only to the top-level bar (RecordDetailPanel via
 *  ZonedDetailTabList); a nested 'group' tab type's own child tab bar
 *  always stays horizontal regardless of this setting — it's a lighter-
 *  weight sub-navigation, not a second top-level bar. */
export type DetailTabOrientation = 'horizontal' | 'vertical'

/** The zone id an unset DetailTabConfig.zone always resolves to — a fixed
 *  id, NOT "whichever zone a template happens to list first." Every
 *  DETAIL_PAGE_LAYOUTS template defines a zone with this id (see below), so
 *  this is a safe, layout-independent default: main-left-sidebar lists
 *  'sidebar' first for VISUAL ordering only, but an unset zone must still
 *  mean "main content," never "whichever side renders first." Getting this
 *  wrong would silently move every pre-existing tab into the sidebar the
 *  moment a form switched to main-left-sidebar. */
export const DEFAULT_DETAIL_PAGE_ZONE = 'main'

export interface DetailPageZoneDef {
  id: string
  label: string
  width: 'flex' | 'narrow'
}

export interface DetailPageLayoutDef {
  label: string
  /** Ordered zones this template defines, in VISUAL left-to-right order —
   *  used for rendering position only. A DetailTabConfig's own `zone`
   *  (below) must match one of these ids to render there — validated only
   *  at the UI layer (the canvas only ever offers the active template's
   *  real zone ids), not the type system, so adding a future template
   *  needs no DetailTabConfig change. Every template MUST define a zone
   *  with id === DEFAULT_DETAIL_PAGE_ZONE ('main') — that's what an unset
   *  DetailTabConfig.zone resolves to, regardless of this array's order. */
  zones: DetailPageZoneDef[]
}

export const DETAIL_PAGE_LAYOUTS: Record<DetailPageLayoutId, DetailPageLayoutDef> = {
  'single':             { label: 'Single column',       zones: [{ id: 'main', label: 'Content', width: 'flex' }] },
  'main-right-sidebar': { label: 'Main + right sidebar', zones: [{ id: 'main', label: 'Content', width: 'flex' }, { id: 'sidebar', label: 'Sidebar', width: 'narrow' }] },
  'main-left-sidebar':  { label: 'Main + left sidebar',  zones: [{ id: 'sidebar', label: 'Sidebar', width: 'narrow' }, { id: 'main', label: 'Content', width: 'flex' }] },
}

/** Configurable record-detail-page tab (FR-D2-015). `type` resolves through
 *  detail-tabs/registry.ts's DetailTabDefinition registry — this schema layer
 *  has no knowledge of what any given type actually renders, only its id,
 *  visibility, and opaque per-type config, mirroring how WidgetInstance
 *  (dashboard/schema.ts) stays opaque to the widget it resolves to. */
export interface DetailTabConfig {
  id: string             // UI-only key (stable across reorders); not meaningful to the backend
  type: string            // registry key: 'details' | 'audit' | 'linked' | 'related_form' | 'custom' | 'field_ref' | ...
  label?: string          // overrides the registry's default label when set
  hidden?: boolean        // reorderable but hidden from the runtime TabsList — distinct from deleting the entry outright, so a hidden tab's config isn't lost
  config: unknown          // type-owned payload, parsed via that type's own DetailTabDefinition.parseConfig
  visibility?: TabVisibilityConfig
  renderIf?: TabRenderCondition
  /** Which zone (of the form's DETAIL_PAGE_LAYOUTS[detailLayout] zones)
   *  this tab occupies. Absent/undefined always means DEFAULT_DETAIL_PAGE_ZONE
   *  ('main') — a fixed id, NOT "whichever zone the active template lists
   *  first" (main-left-sidebar lists 'sidebar' first for visual order only).
   *  This needs no migration for existing saved forms even once a form
   *  switches to a sidebar layout: every pre-existing tab simply lands in
   *  'main'. */
  zone?: string
}

/** Everyone (default) / roles / specific people / roles-or-people. Reuses
 *  the same role-membership semantics canViewMenu already evaluates for
 *  Menu.permission_mode === 'role' (features/auth/permissions.ts) — a
 *  distinct config shape here only because tab visibility also needs the
 *  "specific people" option Menu-level gating has never had. */
export interface TabVisibilityConfig {
  mode: 'everyone' | 'roles' | 'users' | 'roles_or_users'
  roleIds?: string[]
  userIds?: string[]
}

/** Whole-tab conditional rendering — the tab-level analog of
 *  ElementBehavior's field-level VisibilityMode/visibleWhen, reusing the
 *  exact same Vars["fieldKey"] expression addressing and backend evaluator
 *  (features/forms/runtime/expression-context.ts), invoked for the first
 *  time from the read-only record-detail path rather than only FormRenderer. */
export interface TabRenderCondition {
  mode: 'always' | 'expression'
  expressionWhen?: string
}

export function emptyTabVisibility(): TabVisibilityConfig {
  return { mode: 'everyone' }
}

export function emptyTabRenderCondition(): TabRenderCondition {
  return { mode: 'always' }
}

/** Configurable record-detail toolbar action (FR-D2-017). `type` resolves
 *  through custom-actions/registry.ts's CustomActionDefinition registry —
 *  this schema layer has no knowledge of what any given type actually does,
 *  mirroring how DetailTabConfig stays opaque to the tab type it resolves
 *  to. Unlike DetailTabConfig, there's no `hidden`/`zone` (an action has no
 *  reorderable-tab-list positioning concept — menu-item order is simply
 *  array order) and `label` is required (a tab falls back to the registry's
 *  own default label; a menu item's label is always admin-authored, since
 *  "Update Status" carries no sensible generic default the way "Details"
 *  does). Only `update_field` is implemented as of FR-D2-017 v0.1 —
 *  `trigger_workflow` remains an undesigned, un-registered type (see that
 *  document's §8), so `type` is `string`, not a fixed union, the same way
 *  DetailTabConfig.type stays a plain string so new types register without
 *  a schema change. */
export interface CustomActionConfig {
  id: string             // UI-only key (stable across reorders); not meaningful to the backend
  type: string             // registry key: 'update_field' (only registered type as of FR-D2-017 v0.1)
  label: string           // always admin-authored, no registry-default fallback
  config: unknown          // type-owned payload, parsed via that type's own CustomActionDefinition.parseConfig
  visibility?: TabVisibilityConfig
  renderIf?: TabRenderCondition
}

// ---------------------------------------------------------------------------
// Envelope schemas — exported to the backend's /meta/catalog
// ---------------------------------------------------------------------------
//
// JSON Schema descriptions of DetailTabConfig and CustomActionConfig, the
// wrapper objects stored in FormSchema.settings.detailTabs/customActions.
// They live HERE, directly below the interfaces they describe, because
// same-file locality is the only drift defense TypeScript interfaces allow —
// change a field above without touching its schema and the review diff shows
// both side by side. src/lib/ui-catalog.ts exports them; per-TYPE config
// schemas live on each registry entry instead (contract.configSchema).

const TAB_VISIBILITY_SCHEMA = {
  type: 'object',
  description: 'Who may see this entry.',
  required: ['mode'],
  properties: {
    mode: { type: 'string', enum: ['everyone', 'roles', 'users', 'roles_or_users'] },
    roleIds: { type: 'array', items: { type: 'string' }, description: 'Role ids, for the roles/roles_or_users modes.' },
    userIds: { type: 'array', items: { type: 'string' }, description: 'User ids, for the users/roles_or_users modes.' },
  },
} as const

const TAB_RENDER_CONDITION_SCHEMA = {
  type: 'object',
  description: 'Conditional rendering on the record’s own data.',
  required: ['mode'],
  properties: {
    mode: { type: 'string', enum: ['always', 'expression'] },
    expressionWhen: { type: 'string', description: 'Expr expression; Vars["fieldKey"] addresses the record’s fields. The entry renders only when it evaluates true.' },
  },
} as const

export const DETAIL_TAB_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'One entry of FormSchema.settings.detailTabs — a tab on the record-detail page, stored inside the form’s layout blob.',
  required: ['id', 'type', 'config'],
  properties: {
    id: { type: 'string', description: 'UI-only stable key; any unique string.' },
    type: { type: 'string', description: 'Registry key — one of the catalog’s detail_tabs types.' },
    label: { type: 'string', description: 'Overrides the type’s default label.' },
    hidden: { type: 'boolean', description: 'Keep the tab configured but hide it at runtime. Built-in tabs can only be hidden, never removed.' },
    config: { description: 'Type-owned payload — see the matching detail_tabs entry’s config_schema.' },
    visibility: TAB_VISIBILITY_SCHEMA,
    renderIf: TAB_RENDER_CONDITION_SCHEMA,
    zone: { type: 'string', description: 'Zone id from the active detail layout’s zones. Absent always means ‘main’.' },
  },
}

export const CUSTOM_ACTION_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'One entry of FormSchema.settings.customActions — an action on the record-detail toolbar, stored inside the form’s layout blob. Menu-item order is array order.',
  required: ['id', 'type', 'label', 'config'],
  properties: {
    id: { type: 'string', description: 'UI-only stable key; any unique string.' },
    type: { type: 'string', description: 'Registry key — one of the catalog’s custom_actions types.' },
    label: { type: 'string', description: 'The menu item’s visible text. Always admin-authored — there is no registry default.' },
    config: { description: 'Type-owned payload — see the matching custom_actions entry’s config_schema.' },
    visibility: TAB_VISIBILITY_SCHEMA,
    renderIf: TAB_RENDER_CONDITION_SCHEMA,
  },
}

/** Top-level, form-wide settings bag — sibling of sections/variables on
 *  FormSchema. Currently Create User, detailTabs, and customActions; future
 *  form-level toggles land here too rather than growing FormSchema's own
 *  fields. */
export interface FormSettings {
  createUser: CreateUserSettings
  /** Absent/undefined (every form that predates FR-D2-015, or has never
   *  opened the "Detail Page" config panel) resolves to the fixed built-in
   *  three tabs (details/audit/linked) — see
   *  detail-tabs/registry.ts's resolveDetailTabs, the single place that
   *  default is expressed, so RecordDetailPanel.tsx never special-cases an
   *  absent array itself. */
  detailTabs?: DetailTabConfig[]
  /** Which DETAIL_PAGE_LAYOUTS template this form's record-detail page
   *  uses. Absent means 'single' — identical to every form's behavior
   *  before the Detail Page Builder existed (one column, no zone concept),
   *  so no migration is needed for existing saved forms. */
  detailLayout?: DetailPageLayoutId
  /** Absent means 'horizontal' — see DetailTabOrientation's own doc comment. */
  tabOrientation?: DetailTabOrientation
  /** Absent/undefined (every form today) resolves to an empty list — unlike
   *  detailTabs, there is no "at least one" fallback default, since a
   *  record-detail toolbar with zero custom actions (today's universal
   *  state) is a completely normal, not degraded, configuration. */
  customActions?: CustomActionConfig[]
  /** UI workflow run AFTER a record is successfully saved from this form.
   *
   *  AFTER, deliberately, and it cannot veto: the record is already written
   *  by the time these steps run, so a failure here reports and stops the
   *  run without undoing anything. A client-side check that could block a
   *  write would be authorization living in the browser, which the server
   *  would still have to enforce anyway — the form's own Before triggers are
   *  where a genuine veto belongs.
   *
   *  Absent means no steps run, which is every form today. Typed as an
   *  opaque UiWorkflow here for the same reason customActions holds
   *  `unknown` configs: this layer never interprets it. */
  afterSubmitWorkflow?: UiWorkflow
  /** UI workflow run WHILE the form is being filled, when one of its watched
   *  fields changes — cascading defaults, dependent pickers, revealing a
   *  section once an option is picked.
   *
   *  The watch list is required rather than "any field": running on every
   *  keystroke of every field is both wasteful and unpredictable, and naming
   *  the fields is also what stops a set_field step from re-triggering the
   *  workflow that wrote it. */
  fieldChangeWorkflow?: FieldChangeWorkflowConfig
  /** This form's row-level security rules — see AccessScopeRule's own doc
   *  comment. Authored here (viewerModes FilterBuilder, no this_record: a
   *  rule filters every record, not one being authored) but, like
   *  createUser, also projected to an explicit backend column
   *  (access_scope) by serialize.ts's toPayload, since enforcement code
   *  needs to read it directly rather than parsing this opaque blob.
   *  Absent/empty means unrestricted. */
  accessScope?: AccessScopeRule[]
}

export const INVITATION_STATUS_COLUMN: ViewOnlyColumn = { id: 'invitation_status', label: 'Invitation Status' }

export function emptyCreateUserSettings(): CreateUserSettings {
  return { enabled: false, viewOnlyColumns: [INVITATION_STATUS_COLUMN] }
}

export function emptyFormSettings(): FormSettings {
  return { createUser: emptyCreateUserSettings() }
}

/** A single element on the canvas (a field or a presentational block). */
export interface FormElement {
  id: string
  component: ComponentType

  // General
  label: string
  description?: string
  placeholder?: string
  helpText?: string
  key: string               // editable machine name / data key (freely renameable)
  column?: string           // immutable physical column name (backend-assigned)
  unique?: boolean          // adds a UNIQUE constraint (string/number fields only)
  defaultValue?: unknown

  // Marks this field as (one of, possibly several) fields used to build a
  // human-readable title for a record of this form — shown on the runtime
  // Detail page, record drawers, and wherever another form's reference field
  // points at a record of this form, instead of the raw id. Restricted by
  // the config panel to scalar, human-readable component types. Projects to
  // FieldDef.is_record_title (see projection.ts). When multiple elements set
  // this, resolveRecordTitle() (features/forms/runtime/record-title.ts)
  // concatenates their values in document order.
  isRecordTitle?: boolean

  // Marks this field as included in the form's combined full-text search
  // column (backend-generated "tsv"). Restricted by the config panel to
  // text-like component types (supportsSearchable). Projects to
  // FieldDef.searchable (see projection.ts).
  searchable?: boolean

  // Choice components
  options?: SelectOption[]

  // Relational ('form' component): the referenced form's unique identifier.
  // The UI displays the form's name but always stores its id here.
  // Also reused by 'line_item_count' to hold the target Line Items grid's
  // childFormId — same "stores an id, backend resolves the rest" shape.
  formRef?: string

  // Relational ('form' component): the name of a field on the referenced
  // form (formRef) to use as this reference's display/search value at
  // runtime, instead of the name/label/id fallback heuristic. Optional.
  displayField?: string

  // Relational ('form' component): viewer-scoped filter limiting which
  // records of formRef this field may point at ("only suppliers in the
  // current user's area"). This is the REAL workflows FilterGroup shape —
  // unlike AdvancedSettingGroup below, it round-trips to the backend's
  // FieldDef.reference_filter (projection.ts strips the UI-only ids;
  // heal.ts hydrates an API-authored filter back in so a builder save
  // can't silently drop it). Enforced server-side on the picker AND on
  // writes; deleting it here genuinely widens who can pick what.
  referenceFilter?: FilterGroup

  // 'line_item_count' component: which aggregate to compute over the target
  // grid's rows (formRef). Undefined/'count' is the original, count-only
  // behavior of this component — every other value requires aggregateField.
  aggregateFn?: LineItemAggregateFn

  // 'line_item_count' component: the key of a numeric column on the target
  // grid (formRef's lineItemColumns) to aggregate. Required whenever
  // aggregateFn is anything but 'count'/undefined; ignored for 'count'.
  aggregateField?: string

  // Line Items ('line_items' component): the id of the generated child form
  // backing this grid. Empty until the parent form's first save, at which
  // point the builder creates the child form and stores its id here —
  // mirrors formRef's "stores the id, backend resolves the rest" shape. Only
  // meaningful when sourceMode is undefined/'generated' — see adoptedFormRef
  // for the 'existing' case.
  childFormId?: string

  // Line Items ('line_items' component): undefined/'generated' is the
  // original, only-ever-existed behavior — the grid owns a hidden, auto-
  // created child form (childFormId/lineItemColumns), managed entirely by
  // lineItemsSync.ts. 'existing' instead points the grid at an ALREADY
  // EXISTING, independently-visible, independently-permissioned normal form
  // (adoptedFormRef) — that form keeps its own workflows/permissions/
  // standalone page; the grid is just a filtered view into its records via
  // adoptedReferenceField, not an owner of it. lineItemColumns/childFormId
  // are unused in 'existing' mode — the grid's columns come from the
  // adopted form's own real fields instead (see LineItemsGrid's use of
  // useFormDef when sourceMode is 'existing').
  sourceMode?: 'generated' | 'existing'

  // Line Items ('line_items' component, sourceMode 'existing'): the id of
  // the adopted normal form whose records this grid filters/displays. Kept
  // as a separate field from childFormId (rather than reusing it) so the two
  // modes' very different backend contracts — cascade-deleting hidden child
  // vs. a plain reference into an independent form — are never confused by
  // code that only checks "is childFormId set."
  adoptedFormRef?: string

  // Line Items ('line_items' component, sourceMode 'existing'): the name of
  // an ordinary TypeReference field ALREADY PRESENT on the adopted form
  // (adoptedFormRef) that points back at this parent — chosen by the user in
  // the builder, since adoption never creates or modifies fields on a form
  // it doesn't own. Projected to FieldDef.adopted_reference_field on the
  // PARENT's own TypeLineItemAdopted field (see projection.ts).
  adoptedReferenceField?: string

  // Line Items ('line_items' component): the row-editor's own sections of
  // columns of fields — this grid's Fields are projected from these
  // (flattened in document order) on save. Kept here (not just on the child
  // FormDef) so the builder can render/edit them before the child form
  // exists yet. Same section/column/element shape as the main canvas — see
  // LineItemSection's doc comment for why.
  lineItemColumns?: LineItemSection[]

  // Line Items ('line_items' component): Layout/Behavior configuration.
  lineItemConfig?: LineItemsConfig

  // Presentational components (heading/paragraph/divider/spacer)
  content?: string          // heading/paragraph text
  level?: 1 | 2 | 3         // heading level
  height?: number           // spacer height in px

  validation: ElementValidation
  behavior: ElementBehavior
  appearance: ElementAppearance
  binding: ElementBinding

  // Named, targetable, conditional rules — see "Advanced Settings" above.
  advancedSettings?: AdvancedSetting[]
}

// ---------------------------------------------------------------------------
// Layout containers
// ---------------------------------------------------------------------------

/** Predefined column layouts for a section. The numbers are flex ratios. */
export type ColumnLayout =
  | '1'         // [1]
  | '2'         // [1,1]
  | '2-30-70'   // [3,7]
  | '2-70-30'   // [7,3]
  | '3'         // [1,1,1]
  | '4'         // [1,1,1,1]

export const COLUMN_LAYOUTS: Record<ColumnLayout, { label: string; ratios: number[] }> = {
  '1':       { label: '1 Column',          ratios: [1] },
  '2':       { label: '2 Columns (50/50)', ratios: [1, 1] },
  '2-30-70': { label: '2 Columns (30/70)', ratios: [3, 7] },
  '2-70-30': { label: '2 Columns (70/30)', ratios: [7, 3] },
  '3':       { label: '3 Columns',         ratios: [1, 1, 1] },
  '4':       { label: '4 Columns',         ratios: [1, 1, 1, 1] },
}

export interface FormColumn {
  id: string
  /** Flex ratio for this column (derived from the section layout). */
  ratio: number
  elements: FormElement[]
}

export interface FormSection {
  id: string
  title: string
  description?: string
  layout: ColumnLayout
  columns: FormColumn[]
  collapsed?: boolean       // editor-only UI state (persisted for convenience)
}

/** The complete builder schema persisted in the backend `layout` column. */
export interface FormSchema {
  version: 1
  sections: FormSection[]
  /** Workflow variables available for binding/expressions (mirrors the form's
   *  context — populated from declared workflow variables when relevant). */
  variables?: { name: string; type: string }[]
  /** Form-wide settings ("Additional Form Settings" panel). */
  settings?: FormSettings
}

// ---------------------------------------------------------------------------
// Canvas envelopes — exported to the backend's /meta/catalog (ui-catalog)
// ---------------------------------------------------------------------------
//
// The authoring vocabulary for the form CANVAS itself: what one element, one
// section, and the layout root look like — including per-element Advanced
// Settings rules. Same placement rule as the envelopes above: these live
// directly below the interfaces they describe, because same-file locality is
// the only drift defense TypeScript interfaces allow. Every enum inside them
// is DERIVED from a Record<Union, description> map, so adding a union value
// fails compilation here until its description exists — the same trick
// TAB_ORIENTATION_DESCRIPTIONS uses.
//
// With these in the generated ui-catalog, an agent driving the MCP can author
// real layouts (multi-column sections, headings, per-element rules) in
// create_form/update_form's `layout` argument instead of settling for the
// synthesized single-column default.

export const VISIBILITY_MODE_DESCRIPTIONS: Record<VisibilityMode, string> = {
  always: 'Always shown.',
  hidden: 'Never shown (still stored and submitted).',
  expression: "Shown only while behavior.visibleWhen's expression is true.",
}

export const REQUIRED_MODE_DESCRIPTIONS: Record<RequiredMode, string> = {
  always: 'Always required.',
  optional: 'Never required.',
  expression: "Required only while behavior.requiredWhen's expression is true.",
}

export const READ_ONLY_MODE_DESCRIPTIONS: Record<ReadOnlyMode, string> = {
  editable: 'Editable. The default.',
  always: 'Always read-only.',
  expression: "Read-only only while behavior.readOnlyWhen's expression is true.",
}

export const ADVANCED_SETTING_AUDIENCE_DESCRIPTIONS: Record<AdvancedSettingAudience, string> = {
  everyone: 'The rule applies to every user.',
  specific_people: "Applies only to the users listed in 'userIds'.",
  specific_role: "Applies only to users holding a role listed in 'roleIds' (resolve ids via the roles API / list_roles).",
}

export const ADVANCED_SETTING_ACTION_DESCRIPTIONS: Record<AdvancedSettingActionType, string> = {
  hidden_in_ui: 'Hide the element in the form UI (the value is still stored). Presentation only — not a security boundary; use a role’s hidden_fields for real masking.',
  read_only: 'Render the element read-only.',
  show_exception: 'Invert the audience’s restriction — e.g. “hidden for everyone, except this role”.',
  clear_value: 'Clear the element’s value when the conditions match.',
}

export const ADVANCED_SETTING_OP_DESCRIPTIONS: Record<AdvancedSettingCompareOp, string> = {
  eq: 'Field equals the value.',
  neq: 'Field does not equal the value.',
  gt: 'Field is greater than the value.',
  gte: 'Field is greater than or equal to the value.',
  lt: 'Field is less than the value.',
  lte: 'Field is less than or equal to the value.',
  contains: 'Field contains the value as a substring.',
  starts_with: 'Field begins with the value.',
  in: 'Field matches any entry in the value, which must be a list.',
  is_null: 'Field has no value. Takes no comparison value.',
  not_null: 'Field has any value. Takes no comparison value.',
}

/** One per-element Advanced Setting rule (see the Advanced Settings section
 *  above): WHO it applies to, WHEN it applies, and what it does. */
export const ADVANCED_SETTING_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'A named, audience-scoped, conditional rule on one element. Unlike behavior.visibleWhen (one expression, every filler), a rule targets WHO (everyone / specific people / a role) and WHEN (an AND/OR tree over this form’s own fields), and can carry several actions at once.',
  required: ['id', 'name', 'appliesTo', 'when', 'actions'],
  properties: {
    id: { type: 'string', description: 'Any unique string.' },
    name: { type: 'string', description: 'Human-readable rule name shown in the builder.' },
    appliesTo: { type: 'string', enum: Object.keys(ADVANCED_SETTING_AUDIENCE_DESCRIPTIONS) },
    userIds: { type: 'array', items: { type: 'string' }, description: "User ids — when appliesTo is 'specific_people'." },
    roleIds: { type: 'array', items: { type: 'string' }, description: "Role ids — when appliesTo is 'specific_role'." },
    when: {
      type: 'object',
      description: 'AND/OR condition tree over this form’s own field values at fill time. Empty conditions and groups mean the rule always applies.',
      required: ['id', 'combinator', 'conditions', 'groups'],
      properties: {
        id: { type: 'string' },
        combinator: { type: 'string', enum: ['and', 'or'] },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'field', 'op'],
            properties: {
              id: { type: 'string' },
              field: { type: 'string', description: 'This form’s own field key.' },
              op: { type: 'string', enum: Object.keys(ADVANCED_SETTING_OP_DESCRIPTIONS) },
              value: { description: 'Comparison value. Omit for is_null/not_null.' },
            },
          },
        },
        groups: { type: 'array', description: 'Nested groups of the same shape.', items: { type: 'object' } },
      },
    },
    actions: {
      type: 'array',
      description: 'At least one action to perform when the rule matches.',
      items: {
        type: 'object',
        required: ['id', 'type'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: Object.keys(ADVANCED_SETTING_ACTION_DESCRIPTIONS) },
        },
      },
    },
  },
}

/** One canvas element — a field or a presentational block. The authoring
 *  companion to FormElement above; per-component applicability mirrors what
 *  projection.ts reads back, so an element authored from this schema
 *  round-trips to the identical backend field. */
export const FORM_ELEMENT_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'One element on the canvas. ‘component’ comes from canvas.components; data-bearing components project to a backend field whose wire name is ‘key’.',
  required: ['id', 'component', 'label', 'key', 'validation', 'behavior', 'appearance', 'binding'],
  properties: {
    id: { type: 'string', description: 'Any unique string.' },
    component: { type: 'string', description: 'A type from canvas.components.' },
    label: { type: 'string' },
    description: { type: 'string' },
    placeholder: { type: 'string' },
    helpText: { type: 'string' },
    key: { type: 'string', description: 'The wire field name (matches FieldDef.name). Freely renameable.' },
    column: { type: 'string', description: 'Immutable physical column, backend-assigned. Echo it back when editing; never invent one.' },
    unique: { type: 'boolean' },
    defaultValue: { description: 'Static default value.' },
    isRecordTitle: { type: 'boolean', description: 'Part of the record’s human-readable title (scalar components only).' },
    searchable: { type: 'boolean', description: 'Included in full-text search (text-like components only).' },
    options: {
      type: 'array',
      description: 'Choice components (select/radio/multiselect/autocomplete).',
      items: { type: 'object', required: ['label', 'value'], properties: { label: { type: 'string' }, value: { type: 'string' } } },
    },
    formRef: { type: 'string', description: "‘form’ component: the referenced form’s id. ‘line_item_count’: the target grid’s child form id." },
    displayField: { type: 'string', description: '‘form’ component: which field of the referenced form to display/search.' },
    aggregateFn: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'], description: '‘line_item_count’ only.' },
    aggregateField: { type: 'string', description: '‘line_item_count’: numeric field on the target grid; required unless aggregateFn is count.' },
    childFormId: { type: 'string', description: '‘line_items’ (generated mode): backend-managed child form id. Echo, never invent.' },
    sourceMode: { type: 'string', enum: ['generated', 'existing'], description: '‘line_items’: generated hidden child form (default) vs adopting an existing form as the grid.' },
    adoptedFormRef: { type: 'string', description: '‘line_items’ (existing mode): the adopted form’s id.' },
    adoptedReferenceField: { type: 'string', description: '‘line_items’ (existing mode): a reference field ON the adopted form pointing back at this parent.' },
    lineItemColumns: { type: 'array', description: '‘line_items’ (generated mode): the row editor’s own sections — same section shape as canvas.section_envelope.', items: { type: 'object' } },
    lineItemConfig: { type: 'object', description: '‘line_items’: grid display/behavior toggles (allowAddRows, stickyHeader, displayMode…).' },
    content: { type: 'string', description: 'heading/paragraph text.' },
    level: { type: 'integer', enum: [1, 2, 3], description: 'heading level.' },
    height: { type: 'integer', description: 'spacer height in px.' },
    validation: {
      type: 'object',
      properties: {
        minLength: { type: 'integer' }, maxLength: { type: 'integer' },
        min: { type: 'number' }, max: { type: 'number' },
        pattern: { type: 'string', description: 'Regex.' },
        customMessage: { type: 'string' },
        maxFileSizeBytes: { type: 'integer', description: 'file/image only; bytes.' },
        allowedMimeTypes: { type: 'array', items: { type: 'string' }, description: 'file/image only.' },
      },
    },
    behavior: {
      type: 'object',
      required: ['visibility', 'required', 'readOnly'],
      properties: {
        visibility: { type: 'string', enum: Object.keys(VISIBILITY_MODE_DESCRIPTIONS) },
        visibleWhen: { type: 'string', description: 'Expression, when visibility is ‘expression’.' },
        required: { type: 'string', enum: Object.keys(REQUIRED_MODE_DESCRIPTIONS) },
        requiredWhen: { type: 'string' },
        readOnly: { type: 'string', enum: Object.keys(READ_ONLY_MODE_DESCRIPTIONS) },
        readOnlyWhen: { type: 'string' },
        disabled: { type: 'boolean' },
        dynamicDefault: { type: 'string', description: 'Expression producing the default value.' },
      },
    },
    appearance: {
      type: 'object',
      properties: {
        width: { type: 'string', enum: ['full', 'half', 'third', 'quarter', 'auto'] },
        colSpan: { type: 'integer' }, cssClass: { type: 'string' }, tooltip: { type: 'string' },
        prefix: { type: 'string' }, suffix: { type: 'string' }, icon: { type: 'string', description: 'Lucide icon name.' },
      },
    },
    binding: {
      type: 'object',
      required: ['source'],
      properties: {
        source: { type: 'string', enum: ['none', 'form_field', 'workflow_variable', 'expression', 'option_source'] },
        ref: { type: 'string' }, expression: { type: 'string' }, optionSource: { type: 'string' },
      },
    },
    advancedSettings: {
      type: 'array',
      description: 'Named, audience-scoped conditional rules on this element.',
      items: ADVANCED_SETTING_SCHEMA,
    },
  },
}

/** One canvas section of columns of elements. */
export const FORM_SECTION_ENVELOPE_SCHEMA: ConfigSchema = {
  type: 'object',
  required: ['id', 'title', 'layout', 'columns'],
  properties: {
    id: { type: 'string', description: 'Any unique string.' },
    title: { type: 'string' },
    description: { type: 'string' },
    layout: { type: 'string', enum: Object.keys(COLUMN_LAYOUTS), description: 'Column arrangement — see canvas.column_layouts. columns.length and each ratio must match it.' },
    columns: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'ratio', 'elements'],
        properties: {
          id: { type: 'string' },
          ratio: { type: 'number', description: 'Flex ratio from the chosen layout.' },
          elements: { type: 'array', description: 'Elements in order — each per canvas.element_envelope.', items: { type: 'object' } },
        },
      },
    },
    collapsed: { type: 'boolean', description: 'Editor-only convenience.' },
  },
}

/** The layout root — what the backend `layout` column stores. */
export const FORM_LAYOUT_ROOT_SCHEMA: ConfigSchema = {
  type: 'object',
  description: 'The complete builder schema persisted in the form’s layout column. Sections per canvas.section_envelope; settings per forms.detail_page’s envelopes plus createUser.',
  required: ['version', 'sections'],
  properties: {
    version: { type: 'integer', enum: [1] },
    sections: { type: 'array', items: { type: 'object', description: 'Per canvas.section_envelope.' } },
    variables: { type: 'array', items: { type: 'object', required: ['name', 'type'], properties: { name: { type: 'string' }, type: { type: 'string' } } } },
    settings: { type: 'object', description: 'Form-wide settings: createUser (mirrors the create_user_* form arguments), detailTabs, detailLayout, tabOrientation, customActions — shapes under forms.detail_page. Plus two UI-workflow attach points (ui_workflows.envelope): afterSubmitWorkflow, run in the viewer’s client AFTER a record is saved from this form (it cannot veto the save, which has already happened by then); and fieldChangeWorkflow — {"watch": ["field_key", ...], "workflow": {...}} — run WHILE the form is being filled, debounced, whenever one of the watched fields changes (an empty watch list means it never runs). Plus accessScope (mirrors the access_scope form argument): [{"audience": {"type": "everyone"|"role", "role_ids": [...]}, "filter": <FilterGroup, current_user allowed, no this_record/expression>}, ...] — row-level security enforced server-side on every read and write; a viewer matched by no rule is unrestricted, same as an empty list.' },
  },
}

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------

export function emptySchema(): FormSchema {
  return { version: 1, sections: [], settings: emptyFormSettings() }
}
