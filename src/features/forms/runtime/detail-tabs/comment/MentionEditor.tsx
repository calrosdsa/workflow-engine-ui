// FR-D2-016 v0.6 (rich-chip revision) — a contentEditable-based replacement
// for the plain shadcn Textarea in the comment compose/edit boxes,
// specifically so a selected mention renders as a real "@Display Name" chip
// while composing, not the raw @[uuid] wire token (see useMentionEditor's
// doc comment — this was a real, reported UX gap in the earlier plain-
// textarea version: technically correct, since a <textarea> can only ever
// show its literal editable value, but confusing to a user who has no
// reason to know that raw token is what they're looking at).
//
// No existing contentEditable component exists anywhere in this codebase to
// reuse (the "rich text" widget elsewhere is markdown-in-a-Textarea, not a
// WYSIWYG editor) — this is genuinely new surface, kept as small and
// dumb as possible: it owns only rendering + delegating events, all the
// actual chip-insertion/serialization logic lives in mention-dom.ts /
// useMentionEditor.ts so this component stays a thin View.
import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'
import { populateEditorFromBody } from './mention-dom'

export interface MentionEditorHandle {
  /** Rebuilds the editor's DOM from a stored @[uuid] body — used once, when
   *  entering edit mode on an existing comment. resolveName resolves a
   *  mentioned id to its current display name (the same batched
   *  GET /users/basic map CommentRow already has for its own read-only
   *  render). */
  loadBody: (body: string, resolveName: (userId: string) => string) => void
  /** The raw contentEditable DOM node — useMentionEditor's own caret-
   *  tracking/serialization functions (mention-caret.ts, mention-dom.ts)
   *  operate on it directly. Exposed here so callers need only ONE ref
   *  (this component's own forwardRef) rather than juggling a second,
   *  separate ref to the same element for two different purposes. */
  element: HTMLDivElement | null
  /** Empties the editor (used after a successful submit) — goes through
   *  this handle rather than a bare `element.innerHTML = ''` so the
   *  placeholder's empty-state class gets re-toggled too. */
  clear: () => void
}

interface MentionEditorProps {
  onInput: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder: string
  disabled?: boolean
  className?: string
}

/** True when the editor has no real content — "" or the lone stray <br>
 *  some browsers insert into an otherwise-empty contentEditable after a
 *  backspace sequence (textContent alone would report "" for that case too,
 *  but checking it explicitly documents why <br> isn't treated as content). */
function isEditorEmpty(root: HTMLElement): boolean {
  return (root.textContent ?? '').length === 0
}

export const MentionEditor = forwardRef<MentionEditorHandle, MentionEditorProps>(
  ({ onInput, onKeyDown, placeholder, disabled, className }, ref) => {
    const innerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      loadBody: (body, resolveName) => {
        if (innerRef.current) {
          populateEditorFromBody(innerRef.current, body, resolveName)
          innerRef.current.classList.toggle('mention-editor-empty', isEditorEmpty(innerRef.current))
        }
      },
      get element() { return innerRef.current },
      clear: () => {
        if (innerRef.current) {
          innerRef.current.innerHTML = ''
          innerRef.current.classList.add('mention-editor-empty')
        }
      },
    }))

    const handleInput = () => {
      if (innerRef.current) {
        innerRef.current.classList.toggle('mention-editor-empty', isEditorEmpty(innerRef.current))
      }
      onInput()
    }

    return (
      <div
        ref={innerRef}
        contentEditable={!disabled}
        // suppressContentEditableWarning: React normally warns that it
        // doesn't manage contentEditable children — expected and safe here,
        // since this component deliberately never lets React re-render
        // children once mounted (all mutation goes through direct DOM APIs
        // in mention-dom.ts, not React state/props).
        suppressContentEditableWarning
        // A contentEditable div carries no implicit ARIA semantics of its
        // own — without role="textbox" a screen reader announces it as a
        // plain, mute div, not an editable field. aria-multiline reflects
        // that comments can wrap/span lines (a real <textarea>'s default,
        // unlike role="textbox" alone which implies single-line). aria-label
        // reuses the same `placeholder` prop already shown visually via
        // data-placeholder below, since there's no visible <label> element
        // pointing at this div the way a native form control would have
        // one. aria-readonly mirrors contentEditable's own !disabled toggle
        // — accurate, not additive behavior. tabIndex={0} is redundant with
        // contentEditable's own native implicit focusability (the browser
        // already makes this tabbable without it) but role="textbox" reads
        // as a CUSTOM ARIA widget to jsx-a11y's interactive-supports-focus
        // rule, which expects one explicitly — harmless to add since 0 is
        // exactly where it would land in tab order anyway. (A sibling
        // finding, prefer-tag-over-role, suggests swapping this for a real
        // <textarea> — not done: this is deliberately contentEditable so a
        // mention can render as an inline "@Name" chip, which a <textarea>
        // cannot hold; see this file's own top comment.)
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        aria-readonly={disabled}
        tabIndex={0}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder}
        className={cn(
          // Deliberately NOT `flex` (Textarea's own className, which this
          // was originally copied from, has it too — harmless there since a
          // <textarea> doesn't lay out its own content via flexbox). Applied
          // to a contentEditable div, `flex` + the default `align-items:
          // normal` (== stretch) makes every child, including the inline-
          // block mention chip span, a flex item that STRETCHES to the
          // container's full cross-axis height — this is what was actually
          // causing a chip to render several times taller than a line of
          // plain text and spill onto a second visual row, confirmed by
          // inspecting the live computed layout (not a chip-CSS or
          // contenteditable=false quirk, as first suspected). Block-level
          // flow (the default) is what a text-editing surface needs here.
          'mention-editor-empty block min-h-[72px] w-full whitespace-pre-wrap rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      />
    )
  },
)
MentionEditor.displayName = 'MentionEditor'
