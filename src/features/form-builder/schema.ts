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
// Construction helpers
// ---------------------------------------------------------------------------

export function emptySchema(): FormSchema {
  return { version: 1, sections: [], settings: emptyFormSettings() }
}
