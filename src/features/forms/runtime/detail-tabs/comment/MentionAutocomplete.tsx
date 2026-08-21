// FR-D2-016 v0.6 — the @mention autocomplete popover, anchored to the caret
// inside the compose box's plain <textarea> (caret-position.ts's mirror-div
// technique). Deliberately NOT built on cmdk's Command (used by
// UserMultiSelect/FormReferenceSelect elsewhere in this codebase) — those
// pickers own a real <input> themselves, but here the <textarea> must keep
// focus while the user types past the `@`, so this list owns only rendering
// + mouse selection; arrow/Enter/Escape are handled by the compose box's own
// onKeyDown (see Renderer.tsx) forwarding into onNavigate/onSelect below.
import { useEffect } from 'react'
import { Loader2, User } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useMentionableUsers } from '@/features/users/hooks'
import type { BasicUser } from '@/features/users/types'

function userLabel(u: BasicUser): string {
  const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return name || u.email
}

interface MentionAutocompleteProps {
  open: boolean
  query: string
  /** Caret position in viewport coordinates (caret-position.ts) — the
   *  popover anchors a zero-size element there rather than the textarea
   *  itself, so it tracks the cursor, not the field's own bounding box. */
  anchor: { x: number; y: number } | null
  highlightedIndex: number
  onResultsChange: (users: BasicUser[]) => void
  onSelect: (user: BasicUser) => void
  container?: HTMLElement | null
}

export function MentionAutocomplete({ open, query, anchor, highlightedIndex, onResultsChange, onSelect, container }: MentionAutocompleteProps) {
  const { data: results, isLoading } = useMentionableUsers(open ? query : '')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onResultsChange(results ?? []) }, [results])

  if (!anchor) return null

  return (
    <Popover open={open && !!anchor}>
      <PopoverAnchor asChild>
        <div style={{ position: 'fixed', left: anchor.x, top: anchor.y, width: 1, height: 1 }} />
      </PopoverAnchor>
      <PopoverContent
        container={container}
        align="start"
        sideOffset={4}
        className="w-64 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <Loader2 size={13} className="animate-spin" /> Searching…
          </div>
        ) : !results || results.length === 0 ? (
          <div className="py-4 text-center text-[12px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {query ? 'No matching people.' : 'Type a name…'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {results.map((u, i) => (
              <button
                key={u.id}
                type="button"
                // onMouseDown, not onClick — fires before the textarea's own
                // blur, so selecting with the mouse doesn't lose focus/cursor
                // position before insertMention can use it.
                onMouseDown={(e) => { e.preventDefault(); onSelect(u) }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
                style={i === highlightedIndex ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : undefined}
              >
                <User size={13} className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{userLabel(u)}</span>
                  <span className="truncate text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{u.email}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
