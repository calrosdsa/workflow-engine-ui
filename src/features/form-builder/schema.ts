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
  | 'checkbox' | 'switch' | 'radio' | 'select' | 'multiselect' | 'autocomplete'
  // Relational
  | 'form' | 'line_items'
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

/** One column of a Line Items grid — a constrained FormElement: any
 *  data-bearing component except another 'line_items' (no nested grids). */
export type LineItemColumnComponent = Exclude<ComponentType, 'line_items'>

export interface LineItemColumnDef {
  id: string
  component: LineItemColumnComponent
  label: string
  key: string
  options?: SelectOption[]
  formRef?: string
  displayField?: string
  defaultValue?: unknown
  validation: ElementValidation
  behavior: ElementBehavior
}

/** Layout/Behavior configuration for a Line Items field, set in the Config
 *  Panel and stored verbatim in the parent's `layout` (opaque to the backend). */
export interface LineItemsConfig {
  // Layout
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

  // Choice components
  options?: SelectOption[]

  // Relational ('form' component): the referenced form's unique identifier.
  // The UI displays the form's name but always stores its id here.
  formRef?: string

  // Relational ('form' component): the name of a field on the referenced
  // form (formRef) to use as this reference's display/search value at
  // runtime, instead of the name/label/id fallback heuristic. Optional.
  displayField?: string

  // Line Items ('line_items' component): the id of the generated child form
  // backing this grid. Empty until the parent form's first save, at which
  // point the builder creates the child form and stores its id here —
  // mirrors formRef's "stores the id, backend resolves the rest" shape.
  childFormId?: string

  // Line Items ('line_items' component): the mini form-builder's column
  // list — this form's own Fields are projected from these on save. Kept
  // here (not just on the child FormDef) so the builder can render/edit
  // columns before the child form exists yet.
  lineItemColumns?: LineItemColumnDef[]

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
}

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------

export function emptySchema(): FormSchema {
  return { version: 1, sections: [] }
}
