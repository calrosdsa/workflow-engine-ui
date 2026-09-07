import type { NumberFormat } from '../types'

// Number formats in the report editor.
//
// THE DIRECTION IS ONE-WAY AND THAT IS THE WHOLE DESIGN. A report stores a
// semantic descriptor — style, decimals, separators, currency symbol — while
// Univer stores an Excel format code in `style.n.pattern`. Deriving a
// pattern from a descriptor is a lookup; recovering a descriptor from an
// arbitrary pattern is an Excel format-code parser, which the backend
// deliberately refused to write because a partial one misformats silently.
//
// So the descriptor is the source of truth, the pattern is display only, and
// nothing ever parses a pattern. `descriptorForPattern` below is not a
// parser: it matches against patterns this module itself generated from the
// descriptors already present in the report being edited.
//
// This mirrors NumberFormat.ExcelCode() in the Go writer
// (internal/forms/field/number_format.go). It has to agree with it, because
// the same descriptor renders through Go for the exported file and through
// this for the on-canvas preview. Only the CODE is mirrored — the formatter
// itself is not, deliberately: a second implementation of the rounding,
// percent-×100 and negative-placement rules is exactly the drift the backend
// avoided by keeping one formatter.

const DEFAULT_DECIMALS = 2
const MAX_DECIMALS = 10

function decimalsOf(format: NumberFormat): number {
  const d = format.decimals ?? DEFAULT_DECIMALS
  if (d < 0) return 0
  if (d > MAX_DECIMALS) return MAX_DECIMALS
  return d
}

function groups(format: NumberFormat): boolean {
  // Undefined means the default "," — only an explicit empty string turns
  // grouping off, matching the Go side's pointer-means-unset contract.
  return (format.thousands_separator ?? ',') !== ''
}

/**
 * excelPattern derives the Excel format code for a descriptor.
 *
 * NOTE the separators are canonical — "," groups and "." is the decimal
 * point — no matter what the author chose. A stored Excel code cannot encode
 * anything else; the viewing application substitutes its own locale's
 * characters. That is why the on-canvas grid can read 1,234.56 while the
 * exported PDF reads 1.234,56 for the same cell, and why the panel says so
 * out loud rather than leaving it to be filed as a bug.
 */
export function excelPattern(format: NumberFormat): string {
  let base = groups(format) ? '#,##0' : '0'
  const decimals = decimalsOf(format)
  if (decimals > 0) base += `.${'0'.repeat(decimals)}`

  if (format.style === 'percent') {
    base += '%'
  } else if (format.style === 'currency') {
    // Stripped for the same reason the Go side strips them: either
    // character would break out of the quoted literal and produce a code
    // Excel refuses the whole file over.
    const symbol = (format.currency_symbol ?? '').replace(/["\\]/g, '')
    if (symbol) {
      base = format.currency_position === 'suffix' ? `${base}"${symbol}"` : `"${symbol}"${base}`
    }
  }

  return format.negative_style === 'parentheses' ? `${base};(${base})` : base
}

/**
 * sampleFor is the descriptor rendered onto a fixed example number, purely
 * so the panel can show what the author is choosing.
 *
 * It formats ONLY this one constant, which is why it is not a second
 * implementation of the backend formatter: there are no user values, no
 * rounding decisions and no negative case to get wrong. Anything that has to
 * be right for real data goes through the server's own preview.
 */
export const SAMPLE_VALUE = 1234567.891

export function sampleFor(format: NumberFormat): string {
  const decimals = decimalsOf(format)
  const value = format.style === 'percent' ? SAMPLE_VALUE * 100 : SAMPLE_VALUE
  const fixed = value.toFixed(decimals)
  const [whole, fraction] = fixed.split('.')
  const grouped = groups(format)
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands_separator ?? ',')
    : whole
  let out = fraction ? `${grouped}${format.decimal_separator || '.'}${fraction}` : grouped

  if (format.style === 'percent') {
    out += '%'
  } else if (format.style === 'currency' && format.currency_symbol) {
    out = format.currency_position === 'suffix'
      ? `${out}${format.currency_symbol}`
      : `${format.currency_symbol}${out}`
  }
  return out
}

/**
 * patternIndex maps every pattern this module would generate for the
 * descriptors already used in a definition back to its descriptor.
 *
 * This is what lets a format survive the round trip through Univer. Univer
 * only ever holds the derived pattern, so on save the descriptor has to come
 * from somewhere — and taking it from the definition being edited keeps it
 * exact rather than reconstructed. Keying by PATTERN rather than by cell
 * coordinates is deliberate: a pattern travels with its cell when rows are
 * inserted above it, where a coordinate would silently point at the wrong
 * cell.
 */
export function patternIndex(formats: Iterable<NumberFormat>): Map<string, NumberFormat> {
  const index = new Map<string, NumberFormat>()
  for (const format of formats) {
    const pattern = excelPattern(format)
    // First wins. Two descriptors differing only in their separators
    // generate the identical canonical pattern, and neither is more correct
    // than the other — see excelPattern. Choosing deterministically at least
    // makes the collision stable rather than order-dependent per save.
    if (!index.has(pattern)) index.set(pattern, format)
  }
  return index
}

export function descriptorForPattern(
  pattern: string | undefined,
  index: Map<string, NumberFormat>,
): NumberFormat | undefined {
  if (!pattern) return undefined
  return index.get(pattern)
}
