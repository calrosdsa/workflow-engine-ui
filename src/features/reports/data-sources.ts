// Pure helpers behind the Report Builder's data panel (FR-J1-006). Kept out
// of the panel component and out of the store so the rules that matter —
// which names are legal, what a rename breaks, what a legacy report's sources
// are — are testable without mounting a spreadsheet.
import { nanoid } from 'nanoid'
import type {
  ArgumentBinding,
  ArgumentType,
  CompareOp,
  ReportArgument,
  ReportDataSource,
  ReportDefinition,
} from './types'

/** The identifier shape a data-source name must take, so it can be written in
 *  a formula as `Name[Column]`. Deliberately the SAME pattern the backend's
 *  `structuredRefPattern` matches and `isValidRegionName` already enforces —
 *  three copies of this rule would drift. */
const SOURCE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/

export interface SourceNameProblem {
  /** Shown inline under the field. States the consequence, not just "invalid",
   *  because the author's real question is why the name is refused. */
  message: string
}

/** Validates a data-source name for shape and uniqueness (FR-J1-005 DS-03).
 *  Returns undefined when the name is acceptable. Uniqueness is
 *  case-INSENSITIVE because reference resolution is. */
export function validateSourceName(
  name: string,
  existing: ReportDataSource[],
  selfID?: string,
): SourceNameProblem | undefined {
  const trimmed = name.trim()
  if (!trimmed) return { message: 'A data source needs a name.' }

  if (!SOURCE_NAME_PATTERN.test(trimmed)) {
    const hint = /\s/.test(trimmed)
      ? `"${trimmed}" has a space, so it could never be written in a formula as ${trimmed}[Column].`
      : `"${trimmed}" must start with a letter or underscore and use only letters, digits, underscores, or dots.`
    return { message: hint }
  }

  const clash = existing.some(
    (source) => source.id !== selfID && source.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (clash) {
    return { message: `Another data source is already called "${trimmed}". References are case-insensitive, so the two would collide.` }
  }
  return undefined
}

/** Proposes a legal, unique source name from a form's display name — "Line
 *  Charges" becomes "LineCharges". An author can always override it; this
 *  exists so adding a source never opens on a validation error. */
export function suggestSourceName(formName: string, existing: ReportDataSource[]): string {
  const base = formName.replace(/[^A-Za-z0-9_.]/g, '') || 'Source'
  const seed = /^[A-Za-z_]/.test(base) ? base : `S${base}`
  if (!validateSourceName(seed, existing)) return seed
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${seed}${n}`
    if (!validateSourceName(candidate, existing)) return candidate
  }
  return `${seed}${nanoid(4).replace(/[^A-Za-z0-9]/g, '')}`
}

export function createDataSource(formID: string, formName: string, existing: ReportDataSource[]): ReportDataSource {
  return { id: `src_${nanoid(8)}`, name: suggestSourceName(formName, existing), form_id: formID }
}

export function createArgument(existing: ReportArgument[]): ReportArgument {
  const used = new Set(existing.map((a) => a.key))
  let key = 'argument'
  for (let n = 1; used.has(key); n += 1) key = `argument_${n}`
  return { key, label: 'New input', type: 'text' }
}

/** The operator a freshly-added binding starts on, by argument type
 *  (FR-J1-005 BIND-06). A range argument's own gte/lte pair overrides whatever
 *  is stored, so `eq` is a harmless starting point there. */
export function defaultOperatorFor(type: ArgumentType): CompareOp {
  return type === 'text' ? 'contains' : 'eq'
}

/** `range` is only meaningful where an ordered comparison exists, so it is
 *  offered for date and number and nothing else (FR-J1-006 DP-04). */
export function supportsRange(type: ArgumentType): boolean {
  return type === 'date' || type === 'number'
}

/** The binding field that narrows by record identity rather than by column.
 *  Mirrors the backend's own `recordIDField`. */
export const RECORD_ID_FIELD = 'id'

/** Operators legal for a binding, given what it targets. An `id` binding
 *  compiles to `id = ANY(...)`, which expresses inclusion only — the backend
 *  rejects anything else, so the picker must not offer it. */
export function operatorsFor(field: string): CompareOp[] {
  if (field === RECORD_ID_FIELD) return ['eq', 'in']
  return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'in', 'is_null', 'not_null']
}

export function createBinding(argument: ReportArgument, sources: ReportDataSource[]): ArgumentBinding | undefined {
  const source = sources[0]
  if (!source) return undefined
  // A reference argument most often means "this record", which is the id
  // narrowing; anything else starts unbound so the author picks a real field.
  const field = argument.type === 'reference' ? RECORD_ID_FIELD : ''
  return {
    argument_key: argument.key,
    source_id: source.id,
    field,
    op: field === RECORD_ID_FIELD ? 'eq' : defaultOperatorFor(argument.type),
  }
}

/** Where a data-source name is written into a cell formula.
 *
 *  Used for the rename warning (RN-01) and the delete warning (§6 row 2).
 *  Blocks reference a source by `id`, never by name, so a rename can only ever
 *  break formulas — which is precisely why this scans cells and not blocks. */
export interface FormulaReference {
  sheetID: string
  sheetName: string
  /** A1-style address, so the warning can name the cell an author can go look at. */
  address: string
  formula: string
}

export function findFormulaReferences(definition: ReportDefinition, sourceName: string): FormulaReference[] {
  if (!sourceName) return []
  // Word-boundary-ish match on `Name[`: a structured reference is always the
  // name immediately followed by a bracket, so this cannot match a longer name
  // that merely starts with the same letters.
  const pattern = new RegExp(`(^|[^A-Za-z0-9_.])${escapeRegExp(sourceName)}\\s*\\[`, 'i')
  const hits: FormulaReference[] = []

  for (const sheet of definition.workbook?.sheets ?? []) {
    for (const cell of sheet.cells ?? []) {
      if (!cell.formula || !pattern.test(cell.formula)) continue
      hits.push({
        sheetID: sheet.id,
        sheetName: sheet.name,
        address: cellAddress(cell.row, cell.col),
        formula: cell.formula,
      })
    }
  }
  return hits
}

/** Blocks still pointing at a source — the other half of the delete warning. */
export function findBlockReferences(definition: ReportDefinition, sourceID: string): string[] {
  return definition.blocks
    .filter((block) => (block.config as { source_id?: string } | undefined)?.source_id === sourceID)
    .map((block) => block.name || block.id)
}

/** Converts a zero-based row/col to an A1 address (0,0 -> A1). */
export function cellAddress(row: number, col: number): string {
  let n = col
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${letters}${row + 1}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The sources a report effectively has, including the implicit ones a report
 *  authored before FR-J1-005 carries (DS-07, §6 row 5).
 *
 *  A legacy report's blocks name a form directly and have no `data_sources` at
 *  all. Showing the panel an empty list beside populated regions would read as
 *  "this report has no data", so each distinct legacy form is surfaced as a
 *  read-only implicit source instead. */
export interface EffectiveSource extends ReportDataSource {
  /** True when this source is inferred from a legacy block rather than
   *  declared — the panel shows it but must not let it be edited, since there
   *  is nothing in the definition to write the edit back to. */
  implicit?: boolean
}

export function effectiveSources(
  definition: ReportDefinition,
  formName: (formID: string) => string | undefined,
): EffectiveSource[] {
  const declared = definition.data_sources ?? []
  const seenForms = new Set(declared.map((source) => source.form_id))
  const implicit: EffectiveSource[] = []

  for (const block of definition.blocks) {
    const config = block.config as { form_id?: string; source_id?: string } | undefined
    const formID = config?.form_id
    if (!formID || config?.source_id || seenForms.has(formID)) continue
    seenForms.add(formID)
    implicit.push({
      id: `implicit:${formID}`,
      name: block.name || formName(formID) || 'Legacy source',
      form_id: formID,
      implicit: true,
    })
  }
  return [...declared, ...implicit]
}

/** Drops filter conditions an author has added but not yet filled in.
 *
 *  The shared FilterBuilder creates a condition with an empty `field` the
 *  moment "+ Condition" is clicked — a normal half-finished state, since
 *  picking the field is the next click. But the backend rejects the whole
 *  definition for it ("condition field is required"), so without this the
 *  report becomes unsaveable between those two clicks, surfaced as a raw 400.
 *  Found live.
 *
 *  Dropping is safe rather than lossy: a condition with no field expresses no
 *  constraint, so removing it cannot change which rows the report returns.
 *  Pruning happens on SAVE, not on edit, so the unfinished row stays visible
 *  while the author is still working on it. */
export function pruneIncompleteFilters(definition: ReportDefinition): ReportDefinition {
  const sources = definition.data_sources
  if (!sources?.length) return definition

  return {
    ...definition,
    data_sources: sources.map((source) => {
      if (!source.filter) return source
      const filter = pruneGroup(source.filter)
      return filter ? { ...source, filter } : { ...source, filter: undefined }
    }),
  }
}

type EditorFilterGroup = NonNullable<ReportDataSource['filter']>

function pruneGroup(group: EditorFilterGroup): EditorFilterGroup | undefined {
  const conditions = (group.conditions ?? []).filter((c) => c.field)
  const groups = (group.groups ?? [])
    .map((g) => pruneGroup(g))
    .filter((g): g is EditorFilterGroup => g !== undefined)

  // An empty group is dropped entirely rather than sent as `{conditions: []}`
  // — both mean "no constraint", and omitting it keeps the saved definition
  // free of editor leftovers.
  if (conditions.length === 0 && groups.length === 0) return undefined
  return { ...group, conditions, groups }
}

/** Restores the shape `FilterBuilder` requires after a round trip through the
 *  API.
 *
 *  The backend stores a filter as `graph.FilterGroup`, whose `Conditions` and
 *  `Groups` slices carry `omitempty` — so an empty `groups: []` comes back
 *  **absent**, not empty, and the editor's own `id` fields (which Go does not
 *  model) are dropped entirely. FilterBuilder maps over `group.groups`
 *  unguarded, so an author who saved a filter and reopened the report crashed
 *  the panel with "Cannot read properties of undefined (reading 'length')".
 *  Found live.
 *
 *  Normalizing here rather than in FilterBuilder keeps the fix local: that
 *  component is shared with the workflow builder, and widening its contract is
 *  a change to a surface this document does not own. */
export function normalizeFilterGroup(group: EditorFilterGroup | undefined): EditorFilterGroup {
  if (!group) return { id: nanoid(), combinator: 'and', conditions: [], groups: [] }
  return {
    ...group,
    id: group.id || nanoid(),
    combinator: group.combinator ?? 'and',
    conditions: (group.conditions ?? []).map((c) => ({ ...c, id: c.id || nanoid() })),
    groups: (group.groups ?? []).map((g) => normalizeFilterGroup(g)),
  }
}
