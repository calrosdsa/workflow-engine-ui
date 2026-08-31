// Structured-reference autocomplete (FR-J1-006 AC-01/AC-02/AC-03).
//
// Why this exists as our own layer rather than an integration: Univer's
// suggestion popup is built solely from registered FUNCTION descriptions
// (`DescriptionService.getSearchListByNameFirstLetter` reads
// `_functionService.getDescriptions()` and nothing else — verified in the
// shipped bundle and confirmed live, where typing "=SUM(Ch" offers CHISQ.DIST
// and CHOOSE). Registering a region as a sheet table makes
// `=SUM(Charges[Amount])` *evaluate*, but contributes nothing to suggestions.
// Its one injection point, `registerDescriptions`, matches on function-name
// prefix, which cannot express "the columns of this source" at all.
//
// This module is deliberately pure: the rules about what can be completed
// where are the part worth testing, and they should not require a spreadsheet
// to exercise.

/** A data source as the completer sees it: a name and the column labels its
 *  region actually draws. Columns come from the same resolution the header row
 *  uses, so a suggested column is always one the export will produce (AC-02). */
export interface CompletionSource {
  name: string
  columns: string[]
}

export type SuggestionKind = 'source' | 'column'

export interface ReferenceSuggestion {
  /** The text that replaces the partial token on accept (AC-03). */
  token: string
  label: string
  /** Second line — what this reference actually resolves to. */
  detail: string
  kind: SuggestionKind
}

export interface CompletionContext {
  /** Offset in the cell text where the replaceable token starts. */
  start: number
  /** Offset just past the partial token (the caret). */
  end: number
  /** The partial identifier being completed, lower-cased for matching. */
  query: string
  /** Set when the author already typed `Source[`, so only that source's
   *  columns are relevant. */
  sourceName?: string
}

const IDENT = /[A-Za-z0-9_.]/

/**
 * Finds the token under the caret that a structured reference could complete,
 * or undefined when completion does not apply here.
 *
 * Only formulas are considered, and never inside a string literal — `="Charges
 * total"` is prose, not a reference, and offering to rewrite it would be
 * actively wrong.
 */
export function completionContextAt(text: string, caret: number): CompletionContext | undefined {
  if (!text.startsWith('=')) return undefined
  const upTo = text.slice(0, caret)
  if (insideStringLiteral(upTo)) return undefined

  // Case A: already inside brackets — `Charges[Am`. The whole `Source[partial`
  // span is replaced, so accepting yields one well-formed token.
  const open = upTo.lastIndexOf('[')
  if (open !== -1 && !upTo.slice(open).includes(']')) {
    let nameEnd = open
    let nameStart = nameEnd
    while (nameStart > 0 && IDENT.test(upTo[nameStart - 1])) nameStart -= 1
    const sourceName = upTo.slice(nameStart, nameEnd)
    if (!sourceName || !/^[A-Za-z_]/.test(sourceName)) return undefined
    return {
      start: nameStart,
      end: caret,
      query: upTo.slice(open + 1).trim().toLowerCase(),
      sourceName,
    }
  }

  // Case B: a bare identifier — `=SUM(Ch`.
  let start = caret
  while (start > 0 && IDENT.test(upTo[start - 1])) start -= 1
  const query = upTo.slice(start, caret)
  if (!query || !/^[A-Za-z_]/.test(query)) return undefined
  return { start, end: caret, query: query.toLowerCase() }
}

/** True when the caret sits inside an unterminated double-quoted string. */
function insideStringLiteral(upTo: string): boolean {
  let open = false
  for (let i = 0; i < upTo.length; i += 1) {
    if (upTo[i] === '"') open = !open
  }
  return open
}

const MAX_SUGGESTIONS = 8

/**
 * The references offered for a completion context.
 *
 * Inside brackets, only that source's columns. Otherwise both the bare source
 * name and its `Source[Column]` combinations are offered — a single accept
 * then produces a complete, valid reference rather than leaving the author
 * mid-token, which matters because accepting has to close the cell editor
 * (Univer renders it on canvas, so there is no text to splice into).
 */
export function suggestReferences(
  context: CompletionContext,
  sources: CompletionSource[],
): ReferenceSuggestion[] {
  const out: ReferenceSuggestion[] = []

  if (context.sourceName) {
    const source = sources.find((s) => s.name.toLowerCase() === context.sourceName!.toLowerCase())
    if (!source) return []
    for (const column of source.columns) {
      if (!column.toLowerCase().includes(context.query)) continue
      out.push({
        token: `${source.name}[${column}]`,
        label: column,
        detail: `Column of ${source.name}`,
        kind: 'column',
      })
    }
    return out.slice(0, MAX_SUGGESTIONS)
  }

  for (const source of sources) {
    if (!source.name.toLowerCase().startsWith(context.query)) continue
    out.push({
      token: source.name,
      label: source.name,
      detail: source.columns.length > 0 ? `Whole table · ${source.columns.length} columns` : 'Whole table',
      kind: 'source',
    })
    for (const column of source.columns) {
      out.push({
        token: `${source.name}[${column}]`,
        label: `${source.name}[${column}]`,
        detail: `Column of ${source.name}`,
        kind: 'column',
      })
    }
  }
  return out.slice(0, MAX_SUGGESTIONS)
}

/**
 * The cell text after accepting a suggestion (AC-03).
 *
 * Closing parens are balanced because accepting ends the edit: Univer's editor
 * is canvas-rendered with its own document model, so there is no way to insert
 * text and leave the author still typing. Committing `=SUM(Charges[Amount]`
 * would store a syntactically invalid formula; committing
 * `=SUM(Charges[Amount])` stores exactly what the author meant.
 */
export function applySuggestion(
  text: string,
  context: CompletionContext,
  suggestion: ReferenceSuggestion,
): string {
  const completed = text.slice(0, context.start) + suggestion.token + text.slice(context.end)
  return balanceParens(completed)
}

/** Appends the closing parens a formula is missing. Never removes any — an
 *  excess `)` is the author's own text and not this layer's to rewrite. */
export function balanceParens(text: string): string {
  let depth = 0
  let inString = false
  for (const ch of text) {
    if (ch === '"') inString = !inString
    else if (!inString && ch === '(') depth += 1
    else if (!inString && ch === ')') depth = Math.max(0, depth - 1)
  }
  return depth > 0 ? text + ')'.repeat(depth) : text
}
