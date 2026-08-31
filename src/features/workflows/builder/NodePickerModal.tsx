import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Plug } from 'lucide-react'
import { NODE_REGISTRY, PALETTE_NODES, NODE_CATEGORIES } from './node-registry'
import { useConnectorRegistry } from './connector-hooks'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'

interface NodePickerModalProps {
  onSelect: (type: string) => void
  onClose:  () => void
}

// A candidate is either a built-in NodeType (rendered via NODE_REGISTRY, as
// always) or a runtime-discovered connector type (no NODE_REGISTRY entry —
// rendered with a generic plug icon and slate color instead). Discriminated
// by `kind` rather than trying to duck-type "is this a NodeType," which
// would need a runtime membership check against the same union
// widening this file is specifically trying to avoid needing elsewhere.
type Candidate =
  | { kind: 'builtin'; type: NodeType }
  | { kind: 'connector'; type: string; label: string; description: string }

export function NodePickerModal({ onSelect, onClose }: NodePickerModalProps) {
  const [search,    setSearch]    = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: connectorEntries } = useConnectorRegistry()

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Categories gain one more tab, "Connectors", only when at least one is
  // configured — appended after the built-in tabs (NODE_CATEGORIES itself
  // stays untouched, per the connector plan §07) rather than merged into
  // "Integrations", so a connector's presence/absence never shifts where
  // any built-in tab sits.
  const connectorCandidates: Candidate[] = useMemo(
    () => (connectorEntries ?? []).map((c) => ({ kind: 'connector' as const, type: c.type, label: c.label, description: c.description })),
    [connectorEntries],
  )
  const tabs = useMemo(() => {
    const builtinTabs = NODE_CATEGORIES.map((cat) => ({
      label: cat.label,
      candidates: cat.types.map((t): Candidate => ({ kind: 'builtin', type: t })),
    }))
    if (connectorCandidates.length === 0) return builtinTabs
    // "All" (index 0) also gains the connector entries, so searching or
    // browsing the default tab surfaces everything.
    builtinTabs[0] = { ...builtinTabs[0], candidates: [...builtinTabs[0].candidates, ...connectorCandidates] }
    return [...builtinTabs, { label: 'Connectors', candidates: connectorCandidates }]
  }, [connectorCandidates])

  const searchPool: Candidate[] = useMemo(
    () => [...PALETTE_NODES.map((t): Candidate => ({ kind: 'builtin', type: t })), ...connectorCandidates],
    [connectorCandidates],
  )

  const candidateLabel = (c: Candidate) => (c.kind === 'builtin' ? NODE_REGISTRY[c.type].label : c.label)
  const candidateDescription = (c: Candidate) => (c.kind === 'builtin' ? NODE_REGISTRY[c.type].description : c.description)

  const candidates = search
    ? searchPool.filter((c) =>
        candidateLabel(c).toLowerCase().includes(search.toLowerCase()) ||
        candidateDescription(c).toLowerCase().includes(search.toLowerCase())
      )
    : tabs[activeTab].candidates

  return (
    // Backdrop
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
                key={tab.label}
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
                const label = candidateLabel(c)
                const description = candidateDescription(c)
                const Icon = c.kind === 'builtin' ? NODE_REGISTRY[c.type].icon : Plug
                const gradient = c.kind === 'builtin' ? NODE_REGISTRY[c.type].gradient : 'bg-[hsl(var(--foreground))]/70'
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
                      <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{label}</p>
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
