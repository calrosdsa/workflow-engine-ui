import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { NODE_REGISTRY, PALETTE_NODES } from './node-registry'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'

// Groups shown in the picker tabs
const CATEGORIES: { label: string; types: NodeType[] }[] = [
  { label: 'All',          types: PALETTE_NODES },
  { label: 'Data',         types: ['fetch_records', 'upsert_records', 'update_records', 'delete_records', 'transform', 'save_records', 'set_variable'] },
  { label: 'Logic',        types: ['condition', 'iterator', 'merge'] },
  { label: 'Integrations', types: ['http_request'] },
  { label: 'Notify',       types: ['show_message', 'notification'] },
  { label: 'Knowledge',    types: ['knowledge_retrieval', 'knowledge_ingest'] },
  { label: 'Debug',        types: ['debug'] },
]

interface NodePickerModalProps {
  onSelect: (type: NodeType) => void
  onClose:  () => void
}

export function NodePickerModal({ onSelect, onClose }: NodePickerModalProps) {
  const [search,    setSearch]    = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const candidates = search
    ? PALETTE_NODES.filter((t) =>
        NODE_REGISTRY[t].label.toLowerCase().includes(search.toLowerCase()) ||
        NODE_REGISTRY[t].description.toLowerCase().includes(search.toLowerCase())
      )
    : CATEGORIES[activeTab].types

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex max-h-[540px] w-[600px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">

        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveTab(0) }}
            onKeyDown={(e) => {
              // Enter picks the top match — type a few letters and hit Enter.
              if (e.key === 'Enter' && candidates.length > 0) {
                e.preventDefault()
                onSelect(candidates[0])
              }
            }}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          {search && candidates.length > 0 && (
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">↵</kbd>
          )}
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>

        {/* Category tabs — only show when not searching */}
        {!search && (
          <div className="flex gap-1 px-4 pt-3">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  activeTab === i
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Node grid */}
        <div className="overflow-y-auto p-4">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search size={24} className="text-slate-300" />
              <p className="text-sm text-slate-400">No nodes match "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {candidates.map((type) => {
                const reg = NODE_REGISTRY[type]
                const Icon = reg.icon
                return (
                  <button
                    key={type}
                    onClick={() => onSelect(type)}
                    className={cn(
                      'group flex flex-col items-start gap-2.5 rounded-xl border border-slate-200 p-3.5 text-left',
                      'transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md hover:-translate-y-0.5',
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-105',
                      reg.gradient,
                    )}>
                      <Icon size={18} strokeWidth={2.25} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{reg.label}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{reg.description}</p>
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
