import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Plug, FileCode2 } from 'lucide-react'
import { NODE_REGISTRY, PALETTE_NODES, fallbackCategory } from './node-registry'
import { useConnectorRegistry } from './connector-hooks'
import { useNodeTaxonomy, groupByCategory, type PaletteEntry } from './node-taxonomy'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'

interface NodePickerModalProps {
  onSelect: (type: string) => void
  onClose:  () => void
}

export function NodePickerModal({ onSelect, onClose }: NodePickerModalProps) {
  const [search,    setSearch]    = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: connectorEntries } = useConnectorRegistry()
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

  // Every addable node type, whatever its provenance, in ONE list — built-in,
  // connector, and (once they exist) declarative template. Grouping happens
  // downstream on `category`, so this file no longer needs to know which
  // source an entry came from except to badge and colour it.
  //
  // Category comes from the served taxonomy when it has arrived, falling back
  // to the compiled-in one. That is what lets the backend re-group a node, or
  // introduce a category this bundle predates, without a frontend release.
  const entries: PaletteEntry[] = useMemo(() => {
    const servedCategory = new Map((taxonomy?.nodes ?? []).map((n) => [n.type, n.category]))
    const builtins: PaletteEntry[] = PALETTE_NODES.map((type) => ({
      type,
      kind: 'core',
      category: servedCategory.get(type) ?? fallbackCategory(type),
      label: NODE_REGISTRY[type].label,
      description: NODE_REGISTRY[type].description,
    }))
    const runtime: PaletteEntry[] = (connectorEntries ?? []).map((c) => ({
      type: c.type,
      kind: c.kind,
      category: servedCategory.get(c.type) ?? c.category,
      label: c.label,
      description: c.description,
    }))
    return [...builtins, ...runtime]
  }, [connectorEntries, taxonomy])

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
    : (tabs[activeTab]?.entries ?? [])

  return (
    // Backdrop. Click-to-close is a supplementary pointer gesture — Escape
    // (wired above) is the real keyboard equivalent, matching a standard
    // dialog-overlay convention. A fake role/tabIndex on a full-viewport div
    // would just be a purposeless tab stop ahead of the modal's real content.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex max-h-[540px] w-[600px] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl shadow-black/30">

        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[hsl(var(--border))] px-4 py-3.5">
          <Search size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveTab(0) }}
            onKeyDown={(e) => {
              // Enter picks the top match — type a few letters and hit Enter.
              if (e.key === 'Enter' && candidates.length > 0) {
                e.preventDefault()
                onSelect(candidates[0].type)
              }
            }}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--muted-foreground))]"
          />
          {search && candidates.length > 0 && (
            <kbd className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">↵</kbd>
          )}
          <button onClick={onClose} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1">
            <X size={15} />
          </button>
        </div>

        {/* Category tabs — only show when not searching */}
        {!search && (
          <div className="flex gap-1 px-4 pt-3">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                  activeTab === i
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Node grid */}
        <div className="overflow-y-auto p-4">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search size={24} className="text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No nodes match "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {candidates.map((c) => {
                const builtin = c.kind === 'core' ? NODE_REGISTRY[c.type as NodeType] : undefined
                const label = c.label
                const description = c.description
                // A template gets its own icon rather than reusing the
                // connector plug: sharing one would erase the only
                // distinction that matters to someone reading the palette —
                // whether this node's behaviour is data this deployment
                // holds, or a process it merely talks to.
                const Icon = builtin?.icon ?? (c.kind === 'template' ? FileCode2 : Plug)
                const gradient = builtin?.gradient ?? 'bg-[hsl(var(--foreground))]/70'
                return (
                  <button
                    key={c.type}
                    onClick={() => onSelect(c.type)}
                    className={cn(
                      'group flex flex-col items-start gap-2.5 rounded-xl border border-[hsl(var(--border))] p-3.5 text-left',
                      'transition-all hover:border-[hsl(var(--muted-foreground))]/40 hover:bg-[hsl(var(--muted))] hover:shadow-md hover:-translate-y-0.5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105',
                      gradient,
                    )}>
                      <Icon size={18} strokeWidth={2.25} />
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[hsl(var(--foreground))]">
                        {label}
                        {/* Provenance, shown only when it is not the default.
                            Grouping by function means a connector now shares a
                            tab with built-ins, so the badge is what still
                            answers "where does this one actually run?". */}
                        {c.kind !== 'core' && (
                          <span className="rounded-full border border-[hsl(var(--border))] px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                            {c.kind}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
