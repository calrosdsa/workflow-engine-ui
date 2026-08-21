// FR-D2-016 v0.6 — DOM (de)serialization for MentionEditor's contentEditable
// surface. The editor's IN-MEMORY representation is the live DOM itself
// (text nodes + atomic mention chip spans); these functions are the only
// two places that convert between that DOM and the `@[uuid]` wire format
// mentions.ts's regex-based helpers already establish for the plain-text
// world (CommentRow's read-only render, the backend's own parsing).
export const MENTION_CHIP_ATTR = 'data-mention-id'

/** Builds one atomic, non-editable mention chip node — contenteditable=false
 *  is what makes the browser treat it as a single unit for cursor movement
 *  and backspace/delete, not something a user can partially edit into. */
export function createMentionChip(userId: string, displayName: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.setAttribute(MENTION_CHIP_ATTR, userId)
  chip.contentEditable = 'false'
  chip.className = 'mention-chip'
  chip.textContent = `@${displayName}`
  return chip
}

/** Serializes the editor's current DOM content to the `@[uuid]` wire format
 *  the backend expects — walks direct child nodes (text nodes and mention
 *  chip spans), text nodes contribute their raw text, chip spans contribute
 *  `@[uuid]`. Deliberately shallow (no nested-element handling) since the
 *  editor never creates anything deeper than that itself. */
export function serializeEditorContent(root: HTMLElement): string {
  let out = ''
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
    } else if (node instanceof HTMLElement && node.hasAttribute(MENTION_CHIP_ATTR)) {
      out += `@[${node.getAttribute(MENTION_CHIP_ATTR)}]`
    } else if (node instanceof HTMLElement && node.tagName === 'BR') {
      out += '\n'
    } else if (node instanceof HTMLElement) {
      // A stray element (e.g. a <div> the browser inserted for a newline on
      // Enter, in browsers that wrap each line instead of inserting <br>) —
      // fall back to its text content plus a line break, rather than
      // silently dropping whatever the user typed into it.
      out += (out ? '\n' : '') + (node.textContent ?? '')
    }
  }
  return out
}

/** Populates an empty contentEditable root from a stored `@[uuid]` body,
 *  rebuilding mention chips for every resolvable id — the reverse of
 *  serializeEditorContent, used when opening an existing comment for edit.
 *  A mention id not yet present in usersById falls back to a plain
 *  `@User {id.slice(0,8)}` chip rather than blocking the edit UI on a
 *  network round-trip completing first. */
export function populateEditorFromBody(root: HTMLElement, body: string, resolveName: (userId: string) => string): void {
  root.innerHTML = ''
  const MENTION_TOKEN = /@\[([0-9a-fA-F-]{36})\]/g
  let lastIndex = 0
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const index = match.index ?? 0
    if (index > lastIndex) root.appendChild(document.createTextNode(body.slice(lastIndex, index)))
    root.appendChild(createMentionChip(match[1], resolveName(match[1])))
    lastIndex = index + match[0].length
  }
  if (lastIndex < body.length) root.appendChild(document.createTextNode(body.slice(lastIndex)))
}

/** Places the caret immediately after a given node — used after inserting a
 *  freshly-created mention chip (+ trailing space), since the browser has no
 *  reason to know that's where editing should continue. */
export function placeCaretAfter(node: Node): void {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}
