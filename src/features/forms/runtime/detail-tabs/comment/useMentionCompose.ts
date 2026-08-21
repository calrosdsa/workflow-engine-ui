// FR-D2-016 v0.6 — shared @mention-autocomplete wiring for a plain
// <textarea> (compose box create AND CommentRow's own edit box both use
// this, rather than duplicating caret-tracking + keyboard handling twice).
import { useRef, useState } from 'react'
import { getCaretCoordinates } from './caret-position'
import { activeMentionQuery, insertMention } from './mentions'
import type { BasicUser } from '@/features/users/types'

export function useMentionCompose(value: string, onChange: (next: string) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [span, setSpan] = useState<{ start: number; query: string } | null>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [results, setResults] = useState<BasicUser[]>([])
  const [highlighted, setHighlighted] = useState(0)

  const close = () => { setSpan(null); setAnchor(null); setResults([]); setHighlighted(0) }

  const select = (user: BasicUser) => {
    if (!span || !textareaRef.current) return
    const { value: nextValue, cursor } = insertMention(value, span, user.id)
    onChange(nextValue)
    close()
    // Re-focus + restore cursor after React re-renders with the new value —
    // selecting via mouse (onMouseDown, not onClick) already prevented the
    // textarea from losing focus, but the cursor position still needs
    // setting explicitly since the underlying value changed out from under it.
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(cursor, cursor)
    })
  }

  const handleChangeOrSelect = () => {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart ?? 0
    const active = activeMentionQuery(el.value, cursor)
    if (!active) { close(); return }
    setSpan(active)
    setHighlighted(0)
    setAnchor(getCaretCoordinates(el, cursor))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!span || results.length === 0) return false
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((i) => (i + 1) % results.length); return true }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((i) => (i - 1 + results.length) % results.length); return true }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); select(results[highlighted]); return true }
    if (e.key === 'Escape') { e.preventDefault(); close(); return true }
    return false
  }

  return {
    textareaRef,
    mentionOpen: !!span,
    mentionQuery: span?.query ?? '',
    mentionAnchor: anchor,
    mentionResults: results,
    mentionHighlighted: highlighted,
    onMentionResultsChange: setResults,
    onMentionSelect: select,
    /** Call from the textarea's onChange, AFTER updating its value. */
    onTextareaChange: handleChangeOrSelect,
    /** Call from the textarea's onKeyDown — returns true if the key was
     *  consumed by the mention popover (caller should skip its own handling,
     *  e.g. a submit-on-Enter shortcut). */
    onTextareaKeyDown: handleKeyDown,
  }
}
