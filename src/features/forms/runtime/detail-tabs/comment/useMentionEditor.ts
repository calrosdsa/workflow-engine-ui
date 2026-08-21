// FR-D2-016 v0.6 (rich-chip revision) — shared wiring for MentionEditor's
// contentEditable surface, the replacement for the earlier plain-<textarea>
// + raw-@[uuid]-while-typing approach (useMentionCompose.ts, now unused).
// A mentioned user now renders as an actual "@Display Name" chip DURING
// composition, not just after the comment is posted — the raw uuid token
// only ever exists in the serialized wire value, never in what the user
// looks at while typing.
import { useState, useCallback } from 'react'
import { activeMentionSpan, getSelectionCaretCoordinates } from './mention-caret'
import { createMentionChip, serializeEditorContent, placeCaretAfter } from './mention-dom'
import type { BasicUser } from '@/features/users/types'

/** getElement resolves the live contentEditable DOM node on demand (rather
 *  than this hook owning its own ref) — the node actually lives inside
 *  MentionEditor's own forwardRef handle (see MentionEditorHandle.element),
 *  so a caller passes `() => editorHandleRef.current?.element ?? null`
 *  instead of this hook creating a second, redundant ref to the same
 *  element. */
export function useMentionEditor(getElement: () => HTMLDivElement | null, onChange: (serializedValue: string) => void) {
  const [span, setSpan] = useState<{ textNode: Text; start: number; end: number; query: string } | null>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [results, setResults] = useState<BasicUser[]>([])
  const [highlighted, setHighlighted] = useState(0)

  const close = () => { setSpan(null); setAnchor(null); setResults([]); setHighlighted(0) }

  const emitChange = () => {
    const root = getElement()
    if (root) onChange(serializeEditorContent(root))
  }

  const select = useCallback((user: BasicUser) => {
    const root = getElement()
    if (!span || !root) return
    const displayName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email
    // Replace the "@query" text range in place: split the text node at
    // `end`, delete the "@query" portion, insert the chip + a trailing
    // space where it was.
    const { textNode, start, end } = span
    const afterText = textNode.splitText(end)
    textNode.textContent = (textNode.textContent ?? '').slice(0, start)
    const chip = createMentionChip(user.id, displayName)
    const space = document.createTextNode(' ')
    afterText.parentNode?.insertBefore(chip, afterText)
    afterText.parentNode?.insertBefore(space, afterText)
    close()
    placeCaretAfter(space)
    root.focus()
    emitChange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span])

  /** Call on every input event (after the browser has already applied the
   *  keystroke to the DOM) — re-scans for an active @query span at the new
   *  cursor position and re-serializes the value up to the parent. */
  const handleInput = () => {
    const root = getElement()
    if (!root) return
    emitChange()
    const active = activeMentionSpan(root)
    if (!active) { close(); return }
    setSpan(active)
    setHighlighted(0)
    setAnchor(getSelectionCaretCoordinates())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
    if (!span || results.length === 0) return false
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((i) => (i + 1) % results.length); return true }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((i) => (i - 1 + results.length) % results.length); return true }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); select(results[highlighted]); return true }
    if (e.key === 'Escape') { e.preventDefault(); close(); return true }
    return false
  }

  /** Resets this hook's OWN popover state after a submit — the editor's DOM
   *  content itself is cleared separately, by the caller invoking
   *  MentionEditorHandle.clear() directly (this hook doesn't own that DOM
   *  node, MentionEditor does — see getElement's doc comment). */
  const resetAfterSubmit = () => {
    close()
    onChange('')
  }

  return {
    mentionOpen: !!span,
    mentionQuery: span?.query ?? '',
    mentionAnchor: anchor,
    mentionResults: results,
    mentionHighlighted: highlighted,
    onMentionResultsChange: setResults,
    onMentionSelect: select,
    /** Call from the editor's onInput (contentEditable's equivalent of
     *  onChange — fires after the DOM mutation, not before). */
    onEditorInput: handleInput,
    /** Call from the editor's onKeyDown — returns true if the key was
     *  consumed by the mention popover. */
    onEditorKeyDown: handleKeyDown,
    resetAfterSubmit,
  }
}
