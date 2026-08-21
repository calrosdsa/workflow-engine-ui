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
        onInput={handleInput}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder}
        className={cn(
          'mention-editor-empty flex min-h-[72px] w-full whitespace-pre-wrap rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      />
    )
  },
)
MentionEditor.displayName = 'MentionEditor'
