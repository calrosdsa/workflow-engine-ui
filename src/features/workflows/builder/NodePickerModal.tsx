import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { NODE_REGISTRY, PALETTE_NODES } from './node-registry'
import { cn } from '@/lib/utils'
import type { NodeType } from '../types'

const NODE_ICONS: Record<string, string> = {
  entry:        '▶',
  exit:         '⏹',
  set_variable: '✦',
  condition:    '◆',
  subflow:      '⊞',
  merge:        '⊕',
}

// Groups shown in the picker tabs
const CATEGORIES: { label: string; types: NodeType[] }[] = [
  { label: 'All',   types: PALETTE_NODES },
  { label: 'Logic', types: ['condition', 'merge'] },
  { label: 'Data',  types: ['set_variable', 'subflow'] },
]

interface NodePickerModalProps {
  onSelect: (type: NodeType) => void
  onClose:  () => void
}

export function NodePickerModal({ onSelect, onClose }: NodePickerModalProps) {
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState(0)
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-[580px] max-h-[520px] flex flex-col rounded-2xl border bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveTab(0) }}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>

        {/* Category tabs — only show when not searching */}
        {!search && (
          <div className="flex gap-1 border-b px-4 pt-2">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-t transition-colors',
                  activeTab === i
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
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
            <p className="py-8 text-center text-sm text-gray-400">No nodes match "{search}"</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {candidates.map((type) => {
                const reg = NODE_REGISTRY[type]
                return (
                  <button
                    key={type}
                    onClick={() => onSelect(type)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 border-transparent p-4',
                      'hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm',
                      'transition-all text-center group',
                    )}
                  >
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl shadow-sm',
                      reg.color,
                    )}>
                      {NODE_ICONS[type] ?? '●'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{reg.label}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400 leading-tight">{reg.description}</p>
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
