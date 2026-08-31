import { describe, expect, it } from 'vitest'
import {
  applySuggestion,
  balanceParens,
  completionContextAt,
  suggestReferences,
  type CompletionSource,
} from './formula-autocomplete'

const sources: CompletionSource[] = [
  { name: 'Charges', columns: ['Title', 'Amount', 'Tax'] },
  { name: 'Contacts', columns: ['Name', 'Email'] },
]

const ctx = (text: string) => completionContextAt(text, text.length)

describe('completionContextAt', () => {
  it('completes a bare identifier inside a formula', () => {
    expect(ctx('=SUM(Ch')).toMatchObject({ query: 'ch', start: 5, end: 7 })
  })

  it('completes a column once the bracket is open, and replaces the whole token', () => {
    // start points at "Charges", not at "Am", so accepting yields one
    // well-formed `Charges[Amount]` rather than nesting brackets.
    expect(ctx('=SUM(Charges[Am')).toMatchObject({ query: 'am', sourceName: 'Charges', start: 5 })
  })

  it('offers every column when the bracket was just opened', () => {
    expect(ctx('=SUM(Charges[')).toMatchObject({ query: '', sourceName: 'Charges' })
  })

  it('ignores a closed reference — there is nothing left to complete', () => {
    expect(ctx('=SUM(Charges[Amount])')).toBeUndefined()
  })

  it('does not fire outside a formula', () => {
    // Plain text that happens to look like a name is not a reference.
    expect(ctx('Charges')).toBeUndefined()
  })

  it('does not fire inside a string literal', () => {
    // `="Charges total"` is prose; offering to rewrite it would be wrong.
    expect(ctx('="Charges')).toBeUndefined()
  })

  it('resumes completing after a string literal is closed', () => {
    expect(ctx('=CONCAT("x",Ch')).toMatchObject({ query: 'ch' })
  })

  it('does not fire on a token that starts with a digit', () => {
    expect(ctx('=SUM(2Ch')).toBeUndefined()
  })

  it('respects a caret that is not at the end of the text', () => {
    const text = '=SUM(Ch) + 1'
    expect(completionContextAt(text, 7)).toMatchObject({ query: 'ch', end: 7 })
  })
})

describe('suggestReferences', () => {
  it('offers the whole table and each column for a bare prefix', () => {
    const out = suggestReferences(ctx('=SUM(Ch')!, sources)
    expect(out[0]).toMatchObject({ token: 'Charges', kind: 'source' })
    expect(out.map((s) => s.token)).toContain('Charges[Amount]')
    // "Contacts" does not start with "ch"
    expect(out.every((s) => s.token.startsWith('Charges'))).toBe(true)
  })

  it('narrows to one source\'s columns once inside brackets', () => {
    const out = suggestReferences(ctx('=SUM(Charges[a')!, sources)
    expect(out.map((s) => s.token)).toEqual(['Charges[Amount]', 'Charges[Tax]'])
  })

  it('matches a column anywhere in its name, not only the start', () => {
    // Column labels are human phrases ("Total Amount"), so a prefix-only match
    // would miss the word the author is actually thinking of.
    const out = suggestReferences(ctx('=SUM(Charges[ax')!, sources)
    expect(out.map((s) => s.token)).toEqual(['Charges[Tax]'])
  })

  it('returns nothing for a source that does not exist', () => {
    expect(suggestReferences(ctx('=SUM(Nope[a')!, sources)).toEqual([])
  })

  it('is case-insensitive, matching how references resolve', () => {
    expect(suggestReferences(ctx('=SUM(cha')!, sources).length).toBeGreaterThan(0)
  })

  it('caps the list so the popup stays usable', () => {
    const wide: CompletionSource[] = [{ name: 'Wide', columns: Array.from({ length: 40 }, (_, i) => `C${i}`) }]
    expect(suggestReferences(ctx('=SUM(W')!, wide).length).toBeLessThanOrEqual(8)
  })
})

describe('applySuggestion', () => {
  it('replaces the partial token and closes the formula', () => {
    const text = '=SUM(Ch'
    const suggestion = suggestReferences(ctx(text)!, sources).find((s) => s.token === 'Charges[Amount]')!
    // Accepting has to end the edit (the editor is canvas-rendered), so the
    // committed formula must be valid on its own.
    expect(applySuggestion(text, ctx(text)!, suggestion)).toBe('=SUM(Charges[Amount])')
  })

  it('replaces the whole reference when completing from inside brackets', () => {
    const text = '=SUM(Charges[Am'
    const suggestion = suggestReferences(ctx(text)!, sources)[0]
    expect(applySuggestion(text, ctx(text)!, suggestion)).toBe('=SUM(Charges[Amount])')
  })

  it('preserves text after the caret', () => {
    const text = '=SUM(Ch) + 1'
    const context = completionContextAt(text, 7)!
    const suggestion = suggestReferences(context, sources).find((s) => s.token === 'Charges')!
    expect(applySuggestion(text, context, suggestion)).toBe('=SUM(Charges) + 1')
  })
})

describe('balanceParens', () => {
  it('closes what is open', () => {
    expect(balanceParens('=SUM(A')).toBe('=SUM(A)')
    expect(balanceParens('=IF(AND(A,B')).toBe('=IF(AND(A,B))')
  })

  it('leaves a balanced formula alone', () => {
    expect(balanceParens('=SUM(A)')).toBe('=SUM(A)')
  })

  it('never removes an excess paren — that is the author\'s own text', () => {
    expect(balanceParens('=SUM(A))')).toBe('=SUM(A))')
  })

  it('ignores parens inside string literals', () => {
    expect(balanceParens('="a(b"')).toBe('="a(b"')
  })
})
