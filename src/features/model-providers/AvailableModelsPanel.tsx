import { useMemo, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useProviderCatalog } from './hooks'
import { CapabilityBadge } from './CapabilityBadge'
import { PROVIDER_LOGOS, PROVIDER_LABELS } from './logos'
import type { Capability, ProviderType } from './types'

type FilterChip = 'all' | Capability

interface AvailableModelsPanelProps {
  onSelectProvider: (providerType: ProviderType) => void
}

// The right-side "Available models" catalog — search + 2 capability filter
// chips (All / LLM / Embedding, matching this pass' LLM+Embedding-only
// scope; no Rerank/TTS/ASR/VLM/OCR chips, not even disabled ones) + provider
// cards. Clicking a card opens AddProviderDialog for that provider.
export function AvailableModelsPanel({ onSelectProvider }: AvailableModelsPanelProps) {
  const { data: catalog } = useProviderCatalog()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterChip>('all')

  const entries = useMemo(() => {
    const list = catalog ?? []
    const bySearch = search.trim()
      ? list.filter((e) => PROVIDER_LABELS[e.provider].toLowerCase().includes(search.trim().toLowerCase()))
      : list
    if (filter === 'all') return bySearch
    return bySearch.filter((e) => (filter === 'llm' ? e.llm_models.length > 0 : e.embedding_models.length > 0))
  }, [catalog, search, filter])

  const counts = useMemo(() => {
    const list = catalog ?? []
    return {
      all: list.length,
      llm: list.filter((e) => e.llm_models.length > 0).length,
      embedding: list.filter((e) => e.embedding_models.length > 0).length,
    }
  }, [catalog])

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">Available models</h2>

      <div className="relative mb-3">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-8 pl-8 text-[12px]" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterButton label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterButton label="LLM" count={counts.llm} active={filter === 'llm'} onClick={() => setFilter('llm')} />
        <FilterButton label="Embedding" count={counts.embedding} active={filter === 'embedding'} onClick={() => setFilter('embedding')} />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {entries.map((entry) => {
          const Logo = PROVIDER_LOGOS[entry.provider]
          const caps: Capability[] = [
            ...(entry.llm_models.length > 0 ? (['llm'] as const) : []),
            ...(entry.embedding_models.length > 0 ? (['embedding'] as const) : []),
          ]
          return (
            <button
              key={entry.provider}
              type="button"
              onClick={() => onSelectProvider(entry.provider)}
              className="group flex w-full items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-left transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--muted))]/40"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                <Logo size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[hsl(var(--foreground))]">{PROVIDER_LABELS[entry.provider]}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {caps.map((c) => <CapabilityBadge key={c} capability={c} />)}
                </span>
              </span>
              <Plus
                size={16}
                className="shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
      )}
    >
      {label}
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  )
}
