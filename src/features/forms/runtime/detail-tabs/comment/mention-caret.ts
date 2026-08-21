// FR-D2-016 v0.6 — cursor/selection helpers for MentionEditor's
// contentEditable surface. Unlike a <textarea> (a single string + a numeric
// cursor offset, see mentions.ts's activeMentionQuery), a contentEditable's
// cursor lives in a Selection/Range addressing a specific text NODE + an
// offset within it — these functions work in that model instead.

/** The active `@query` span at the current selection, if the caret sits
 *  inside a text node right after an unclosed `@word` — same matching rule
 *  as the <textarea> version (a `@` not preceded by a word character,
 *  followed by non-whitespace up to the cursor), just addressed by
 *  (textNode, offset) instead of a flat string offset. Returns null when the
 *  caret isn't collapsed inside a plain text node (e.g. selection spans
 *  multiple nodes, or sits inside/adjacent to a mention chip). */
export function activeMentionSpan(root: HTMLElement): { textNode: Text; start: number; end: number; query: string } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null

  const text = node.textContent ?? ''
  const cursor = range.startOffset
  const beforeCursor = text.slice(0, cursor)
  const at = beforeCursor.lastIndexOf('@')
  if (at === -1) return null
  const charBeforeAt = at > 0 ? beforeCursor[at - 1] : ''
  if (/\w/.test(charBeforeAt)) return null
  const between = beforeCursor.slice(at + 1)
  if (/\s/.test(between)) return null

  return { textNode: node as Text, start: at, end: cursor, query: between }
}

/** Returns the viewport (fixed-position) coordinates of the current caret —
 *  used to anchor the mention popover, same role caret-position.ts's
 *  getCaretCoordinates plays for a <textarea>, but via the real
 *  Selection/Range API instead of a mirror-div (a contentEditable's
 *  Range.getBoundingClientRect() already gives real screen coordinates
 *  directly, no measurement trick needed). */
export function getSelectionCaretCoordinates(): { x: number; y: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rect = range.getBoundingClientRect()
  // A collapsed range at the very start of an empty node can report an
  // all-zero rect in some browsers — fall back to the node's own element
  // rect (its parent) so the popover still anchors somewhere sane instead
  // of at (0, 0).
  if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
    const el = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement
    if (!el) return null
    const elRect = el.getBoundingClientRect()
    return { x: elRect.left, y: elRect.bottom }
  }
  return { x: rect.left, y: rect.bottom }
}
