import type { ComponentType as ComponentTypeReact } from 'react'
import {
  Type, AlignLeft, Hash, Mail, Lock, Phone, Link2,
  Calendar, Clock, CalendarClock,
  CheckSquare, ToggleLeft, CircleDot, ChevronDownSquare, ListChecks, Search, ShieldCheck,
  Upload, Image,
  FileText, Minus, Heading, Pilcrow, StretchVertical, EyeOff,
  FormInput, Table2, ListOrdered,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType, ComponentCategory } from './schema'
import type { FieldType } from '@/features/forms/types'
import {
  HeadingForm, ParagraphForm, SpacerForm, DividerForm, HiddenForm,
  type PresentationalFormProps,
} from './config/PresentationalForms'

export interface ComponentRegistryEntry {
  type: ComponentType
  label: string
  icon: LucideIcon
  category: ComponentCategory
  /** True when this component holds data (maps to a SQL column on save). */
  dataBearing: boolean
  /** The backend FieldType this maps to (only for dataBearing components). */
  fieldType?: FieldType
  description: string
  /** Renders this type's General-tab body. Only set for the 5 presentational
   *  types — the other 19 share ConfigPanel.tsx's ElementConfig tabs
   *  directly (a shared flow, not one-component-per-type). */
  configPanel?: ComponentTypeReact<PresentationalFormProps>
}

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentRegistryEntry> = {
  // --- Input ---
  text:      { type: 'text',      label: 'Text Input',   icon: Type,      category: 'Input', dataBearing: true,  fieldType: 'string',   description: 'Single-line text' },
  textarea:  { type: 'textarea',  label: 'Text Area',    icon: AlignLeft, category: 'Input', dataBearing: true,  fieldType: 'text',     description: 'Multi-line text' },
  number:    { type: 'number',    label: 'Number',       icon: Hash,      category: 'Input', dataBearing: true,  fieldType: 'decimal',  description: 'Numeric input' },
  email:     { type: 'email',     label: 'Email',        icon: Mail,      category: 'Input', dataBearing: true,  fieldType: 'email',    description: 'Email address' },
  password:  { type: 'password',  label: 'Password',     icon: Lock,      category: 'Input', dataBearing: true,  fieldType: 'string',   description: 'Masked input' },
  phone:     { type: 'phone',     label: 'Phone Number', icon: Phone,     category: 'Input', dataBearing: true,  fieldType: 'phone',    description: 'Phone number' },
  url:       { type: 'url',       label: 'URL',          icon: Link2,     category: 'Input', dataBearing: true,  fieldType: 'string',   description: 'Web address' },

  // --- DateTime ---
  date:      { type: 'date',      label: 'Date',         icon: Calendar,      category: 'DateTime', dataBearing: true, fieldType: 'date',     description: 'Date picker' },
  time:      { type: 'time',      label: 'Time',         icon: Clock,         category: 'DateTime', dataBearing: true, fieldType: 'time',     description: 'Time picker' },
  datetime:  { type: 'datetime',  label: 'Date & Time',  icon: CalendarClock, category: 'DateTime', dataBearing: true, fieldType: 'datetime', description: 'Date and time' },

  // --- Choice ---
  checkbox:    { type: 'checkbox',    label: 'Checkbox',     icon: CheckSquare,       category: 'Choice', dataBearing: true, fieldType: 'boolean', description: 'Single checkbox' },
  switch:      { type: 'switch',      label: 'Switch',       icon: ToggleLeft,        category: 'Choice', dataBearing: true, fieldType: 'boolean', description: 'On/off toggle' },
  radio:       { type: 'radio',       label: 'Radio Group',  icon: CircleDot,         category: 'Choice', dataBearing: true, fieldType: 'enum',    description: 'Pick one option' },
  select:      { type: 'select',      label: 'Select',       icon: ChevronDownSquare, category: 'Choice', dataBearing: true, fieldType: 'enum',    description: 'Dropdown select' },
  multiselect: { type: 'multiselect', label: 'Multi Select', icon: ListChecks,        category: 'Choice', dataBearing: true, fieldType: 'json',    description: 'Pick several options' },
  autocomplete:{ type: 'autocomplete',label: 'Autocomplete', icon: Search,            category: 'Choice', dataBearing: true, fieldType: 'string',  description: 'Searchable select' },
  form:        { type: 'form',        label: 'Form Reference', icon: FormInput,        category: 'Choice', dataBearing: true, fieldType: 'reference', description: 'Reference another form' },
  line_items:  { type: 'line_items',  label: 'Line Items',    icon: Table2,            category: 'Choice', dataBearing: false, description: 'Embedded child record grid' },
  // Unlike line_items itself (dataBearing: false, never becomes a FieldDef),
  // this DOES flow through to a real backend field — dataBearing: true is
  // correct — but the backend excludes it from DDL/selectCols since it has
  // no physical column, resolving its value at read time instead.
  line_item_count: { type: 'line_item_count', label: 'Line Item Count', icon: ListOrdered, category: 'Choice', dataBearing: true, fieldType: 'line_item_count', description: "Count of a Line Items grid's rows" },
  // fieldType 'string', not 'enum': a role's valid values are the app's
  // dynamic role-id set, not something declarable as a fixed CHECK
  // constraint at form-save time — FieldDef.Validate() (backend) rejects
  // any TypeEnum field with an empty enum_values list, which a role field
  // would always have since options come from useRoles(appId) at fill
  // time, never from static el.options. Mirrors 'autocomplete' below,
  // which is 'string' for the same "dynamic, not statically enumerable"
  // reason.
  role:        { type: 'role',        label: 'Role',          icon: ShieldCheck,       category: 'Choice', dataBearing: true, fieldType: 'string', description: 'Assign a role' },

  // --- Media ---
  file:      { type: 'file',  label: 'File Upload',  icon: Upload, category: 'Media', dataBearing: true, fieldType: 'file', description: 'Upload a file' },
  image:     { type: 'image', label: 'Image Upload', icon: Image,  category: 'Media', dataBearing: true, fieldType: 'file', description: 'Upload an image' },

  // --- Layout / presentational (NOT data-bearing) ---
  richtext:  { type: 'richtext',  label: 'Rich Text',  icon: FileText,        category: 'Layout', dataBearing: true,  fieldType: 'text', description: 'Formatted text input' },
  divider:   { type: 'divider',   label: 'Divider',    icon: Minus,           category: 'Layout', dataBearing: false, description: 'Horizontal line', configPanel: DividerForm },
  heading:   { type: 'heading',   label: 'Heading',    icon: Heading,         category: 'Layout', dataBearing: false, description: 'Section heading', configPanel: HeadingForm },
  paragraph: { type: 'paragraph', label: 'Paragraph',  icon: Pilcrow,         category: 'Layout', dataBearing: false, description: 'Static text block', configPanel: ParagraphForm },
  spacer:    { type: 'spacer',    label: 'Spacer',     icon: StretchVertical, category: 'Layout', dataBearing: false, description: 'Vertical space', configPanel: SpacerForm },
  hidden:    { type: 'hidden',    label: 'Hidden Field', icon: EyeOff,        category: 'Layout', dataBearing: true,  fieldType: 'string', description: 'Stored, not shown', configPanel: HiddenForm },
}

export const COMPONENT_CATEGORIES: ComponentCategory[] = ['Input', 'Choice', 'DateTime', 'Media', 'Layout']

export function componentsByCategory(cat: ComponentCategory): ComponentRegistryEntry[] {
  return Object.values(COMPONENT_REGISTRY).filter((c) => c.category === cat)
}

// Backend field types a UNIQUE constraint is meaningful for: text-like and
// numeric columns. (Booleans, enums, json/file and references are excluded.)
const UNIQUE_CAPABLE_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'string', 'text', 'email', 'phone', 'integer', 'decimal',
])

/** True when a component maps to a string- or number-typed column that can carry
 *  a UNIQUE constraint. Drives the "Unique" toggle in the config panel. */
export function supportsUnique(type: ComponentType): boolean {
  const ft = COMPONENT_REGISTRY[type].fieldType
  return !!ft && UNIQUE_CAPABLE_FIELD_TYPES.has(ft)
}

// Backend field types that stringify into something meaningful as part of a
// record's title: scalar, human-readable types only. Excludes boolean-
// adjacent choice widgets that don't read as a "name" (radio/select/
// multiselect still map to 'enum'/'json' and are handled by their own
// fieldType, not by component), and structural/opaque types (json, file,
// reference, line_item_count/adopted, parent_link).
const RECORD_TITLE_CAPABLE_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'string', 'text', 'email', 'phone', 'integer', 'decimal', 'enum',
  'date', 'time', 'datetime', 'boolean',
])

/** True when a component's backend field type is human-readable enough to be
 *  used as (part of) a record's title. Drives the "Use in Record Title"
 *  toggle in the config panel — see FormElement.isRecordTitle. */
export function supportsRecordTitle(type: ComponentType): boolean {
  const ft = COMPONENT_REGISTRY[type].fieldType
  return !!ft && RECORD_TITLE_CAPABLE_FIELD_TYPES.has(ft)
}

// Backend field types meaningful in full-text search: text-like only.
// Numbers are excluded — full-text/stemmed matching isn't useful for them
// and they're already covered by the existing contains/eq filters.
const SEARCHABLE_CAPABLE_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'string', 'text', 'email', 'phone',
])

/** True when a component maps to a text-like column eligible for the form's
 *  combined full-text search index. Drives the "Include in Search" toggle
 *  in the config panel — see FieldDef.searchable. */
export function supportsSearchable(type: ComponentType): boolean {
  const ft = COMPONENT_REGISTRY[type].fieldType
  return !!ft && SEARCHABLE_CAPABLE_FIELD_TYPES.has(ft)
}
