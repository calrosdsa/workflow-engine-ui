import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { NODE_REGISTRY, PALETTE_NODES, fallbackCategory } from './node-registry'
import { useNodeTaxonomy, groupByCategory, type PaletteEntry } from './node-taxonomy'
import { iconFor } from './icon-hints'
import { AppPickerPanel, type PickerSelection } from './AppPickerPanel'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'

interface NodePickerModalProps {
  onSelect: (selection: PickerSelection) => void
  onClose:  () => void
}

export function NodePickerModal({ onSelect, onClose }: NodePickerModalProps) {
  const t = useTranslation()
  const [search,    setSearch]    = useState('')
  // 'apps' is a distinct, additive browsing mode alongside the numeric
  // category tabs — NOT a replacement for them. A package node still also
  // appears under its own functional-category tab exactly as today;
  // nothing is removed from those tabs by adding this one, unlike the old
  // per-source "Connectors" tab this file's own tests guard against
  // reintroducing (see NodePickerModal.test.tsx's "has no Connectors tab
  // any more").
  const [activeTab, setActiveTab] = useState<number | 'apps'>(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: taxonomy } = useNodeTaxonomy()

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Every addable node type, whatever its provenance, in ONE list — built-in
  // and package alike. Grouping happens downstream on `category`, so this
  // file no longer needs to know which source an entry came from except to
  // badge and colour it.
  //
  // A core entry's category comes from the served taxonomy when it has
  // arrived, falling back to the compiled-in one — that is what lets the
  // backend re-group a node, or introduce a category this bundle predates,
  // without a frontend release. A package entry has no compiled-in fallback
  // at all; it exists here only because the taxonomy served it.
  const entries: PaletteEntry[] = useMemo(() => {
    const servedCategory = new Map((taxonomy?.nodes ?? []).map((n) => [n.type, n.category]))
    const builtins: PaletteEntry[] = PALETTE_NODES.map((type) => ({
      type,
      kind: 'core',
      category: servedCategory.get(type) ?? fallbackCategory(type),
      label: NODE_REGISTRY[type].label,
      description: NODE_REGISTRY[type].description,
    }))
    const runtime: PaletteEntry[] = (taxonomy?.nodes ?? [])
      .filter((n) => n.kind === 'package')
      .map((n) => ({
        type: n.type,
        kind: 'package' as const,
        category: n.category,
        label: n.display_name || n.type,
        description: n.summary ?? '',
        iconHint: n.icon_hint,
      }))
    return [...builtins, ...runtime]
  }, [taxonomy])

  // "All" first, then one tab per OCCUPIED category. A category with no
  // members never renders, which is what lets the vocabulary reserve a name
  // ahead of the nodes that will fill it.
  const tabs = useMemo(() => {
    const groups = groupByCategory(entries, taxonomy?.categories ?? [])
    return [{ id: 'all', label: 'All', entries }, ...groups]
  }, [entries, taxonomy])

  const candidates = search
    ? entries.filter((c) =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
      )
    : (typeof activeTab === 'number' ? (tabs[activeTab]?.entries ?? []) : [])

  return (
    // Backdrop. Click-to-close is a supplementary pointer gesture — Escape
    // (wired above) is the real keyboard equivalent, matching a standard
    // dialog-overlay convention. A fake role/tabIndex on a full-viewport div
    // would just be a purposeless tab stop ahead of the modal's real content.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="absolute inset-0 z-50 flex justify-end bg-[hsl(var(--background))]/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex h-full max-h-none w-[min(32rem,100vw)] flex-col overflow-hidden border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl shadow-black/30">

        {/* Header */}
        <div className="border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Add a workflow step</p>
              <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Search by capability, service, or node type.</p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1" title="Close node picker">
              <X size={15} />
            </button>
          </div>
          {/* Own search box, hidden in Apps mode — AppPickerPanel renders
              its own (scoped to app names, not node labels/descriptions),
              and showing both at once would be confusing about which one
              a keystroke is filtering. */}
          {activeTab !== 'apps' && (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 focus-within:border-[hsl(var(--primary))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]/30">
            <Search size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveTab(0) }}
              onKeyDown={(e) => {
                // Enter picks the top match — type a few letters and hit Enter.
                if (e.key === 'Enter' && candidates.length > 0) {
                  e.preventDefault()
                  onSelect({ kind: 'node', type: candidates[0].type })
                }
              }}
              placeholder="Search nodes…"
              className="h-9 flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            />
            {search && candidates.length > 0 && (
              <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">↵</kbd>
            )}
          </div>
          )}
        </div>

        {/* Category tabs — only show when not searching. "Apps" is always
            last, after every occupied category — an additional browsing
            mode, not competing for the front-of-list position with the
            function-based tabs a node is normally found under. */}
        {!search && (
          <div className="flex gap-1 overflow-x-auto px-5 pt-3">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                  activeTab === i
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {tab.label}
              </button>
            ))}
            <button
              onClick={() => setActiveTab('apps')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                activeTab === 'apps'
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {t('workflows.node_picker.apps_tab')}
            </button>
          </div>
        )}

        {/* Body: the Apps tab swaps in its own two-screen browsing panel
            (which has its own search box) in place of the flat node grid
            below — not a second modal, just a different body for the same
            frame. */}
        {!search && activeTab === 'apps' ? (
          <AppPickerPanel scope="triggers-and-actions" onSelect={onSelect} />
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search size={24} className="text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No nodes match "{search}"</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {candidates.map((c) => {
                const builtin = c.kind === 'core' ? NODE_REGISTRY[c.type as NodeType] : undefined
                const label = c.label
                const description = c.description
                const Icon = iconFor(c.type, c.iconHint)
                const gradient = builtin?.gradient ?? 'bg-[hsl(var(--foreground))]/70'
                return (
                  <button
                    key={c.type}
                    onClick={() => onSelect({ kind: 'node', type: c.type })}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left',
                      'transition-[border-color,background-color,box-shadow,transform] hover:border-[hsl(var(--muted-foreground))]/40 hover:bg-[hsl(var(--muted))] hover:shadow-md hover:-translate-y-0.5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                    )}
                  >
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-105',
                      gradient,
                    )}>
                      <Icon size={18} strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[hsl(var(--foreground))]">
                        {label}
                        {/* Provenance, shown only when it is not the default.
                            Grouping by function means a package node now
                            shares a tab with built-ins, so the badge is what
                            still answers "where does this one come from?". */}
                        {c.kind !== 'core' && (
                          <span className="rounded-full border border-[hsl(var(--border))] px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            {c.kind}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">{description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
