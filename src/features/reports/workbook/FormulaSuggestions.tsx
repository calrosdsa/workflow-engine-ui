// The suggestion popup for structured references (FR-J1-006 AC-01..AC-03).
//
// Rendered by us rather than by Univer: its own formula popup is built from
// registered function descriptions only, and its single injection point keys
// off function-name prefix, which cannot express "this source's columns".
// See formula-autocomplete.ts for the full finding.
import { Database, Table2 } from 'lucide-react'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ReferenceSuggestion } from './formula-autocomplete'

export interface FormulaSuggestionsProps {
  suggestions: ReferenceSuggestion[]
  /** Viewport rect of the cell being edited, from FRange.getCellRect(). */
  anchor: { left: number; top: number; bottom: number }
  onAccept: (suggestion: ReferenceSuggestion) => void
}

export function FormulaSuggestions({ suggestions, anchor, onAccept }: FormulaSuggestionsProps) {
  const t = useTranslation()
  if (suggestions.length === 0) return null

  // Univer shows its OWN function popup for the same keystrokes (typing
  // "=SUM(Ch" offers CHISQ.DIST and CHOOSE). It is fixed, 250px wide, anchored
  // at the cell's left edge, at z-index 1020 — measured live, where it covered
  // this popup completely. Both lists are legitimate answers to what the
  // author typed, so this one sits BESIDE it rather than over it, and stacks
  // above so it can never be the hidden one.
  const UNIVER_POPUP_CLEARANCE = 264
  const WIDTH = 256
  const left = Math.min(anchor.left + UNIVER_POPUP_CLEARANCE, window.innerWidth - WIDTH - 8)

  // Flips above the cell when there is not enough room below, so a reference
  // near the bottom of the sheet is still completable.
  const spaceBelow = window.innerHeight - anchor.bottom
  const flip = spaceBelow < 200
  const style: React.CSSProperties = flip
    ? { left, bottom: window.innerHeight - anchor.top + 2, zIndex: 1030 }
    : { left, top: anchor.bottom + 2, zIndex: 1030 }

  return (
    <div
      className="fixed max-h-72 w-64 overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg"
      style={style}
      role="listbox"
      aria-label={t('reports.formula_suggestions.aria_label')}
    >
      <div className="sticky top-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {t('reports.formula_suggestions.header')}
      </div>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.token}
          type="button"
          role="option"
          aria-selected={false}
          // onMouseDown, not onClick: the cell editor is still focused, and a
          // click would blur it first — ending the edit before we can read the
          // text we are completing.
          onMouseDown={(event) => {
            event.preventDefault()
            onAccept(suggestion)
          }}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-[hsl(var(--accent))]"
        >
          {suggestion.kind === 'source'
            ? <Database size={12} className="shrink-0 text-[hsl(var(--primary))]" />
            : <Table2 size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[11px] text-[hsl(var(--foreground))]">{suggestion.label}</span>
            <span className="block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{suggestion.detail}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
