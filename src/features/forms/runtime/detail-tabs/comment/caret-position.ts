// FR-D2-016 v0.6 — caret-coordinate mirror-div technique for anchoring the
// mention-autocomplete popover to the cursor inside a plain <textarea>,
// which has no native API for this (confirmed — no existing component in
// this codebase does inline-textarea-autocomplete-at-cursor; this is the
// standard, well-established approach for the problem, not a novel one).
//
// A hidden div, styled identically to the textarea (font, padding, width,
// white-space wrapping), is filled with the textarea's text up to the
// cursor plus a marker span. The marker's own bounding rect — offset by the
// textarea's own position on screen and its current scroll — is the caret's
// real screen position.

const MIRRORED_PROPERTIES: (keyof CSSStyleDeclaration)[] = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontFamily',
  'lineHeight', 'letterSpacing', 'textTransform', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordWrap',
]

/** Returns the caret's on-screen position (viewport coordinates, matching
 *  getBoundingClientRect's own frame) for a given cursor offset inside a
 *  textarea — used as the mention popover's anchor point. */
export function getCaretCoordinates(textarea: HTMLTextAreaElement, cursor: number): { x: number; y: number } {
  const div = document.createElement('div')
  const style = getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()

  div.style.position = 'fixed'
  div.style.visibility = 'hidden'
  div.style.left = `${rect.left}px`
  div.style.top = `${rect.top}px`

  for (const prop of MIRRORED_PROPERTIES) {
    const value = style[prop]
    if (typeof value === 'string') (div.style as unknown as Record<string, string>)[prop] = value
  }
  div.style.wordWrap = 'break-word'
  div.style.whiteSpace = 'pre-wrap'

  const before = document.createTextNode(textarea.value.slice(0, cursor))
  div.appendChild(before)
  const marker = document.createElement('span')
  marker.textContent = '​' // zero-width space — keeps the marker's box even at the end of a line
  div.appendChild(marker)
  div.appendChild(document.createTextNode(textarea.value.slice(cursor)))

  document.body.appendChild(div)
  const markerRect = marker.getBoundingClientRect()
  // Subtract the textarea's own scroll so the coordinate reflects what's
  // actually visible, matching how the browser positions the real caret.
  const x = markerRect.left - textarea.scrollLeft
  const y = markerRect.top - textarea.scrollTop + Number.parseFloat(style.lineHeight || '16')
  document.body.removeChild(div)

  return { x, y }
}
