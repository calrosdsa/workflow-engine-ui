// A searchable combobox for picking a saved LLM/Embedding Provider by name —
// mirrors app-settings/CredentialSelect.tsx's async-picker pattern exactly,
// filtered by `kind` since a Knowledge Base needs one Provider for its LLM
// calls and (possibly a different) one for embedding calls.
import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useLLMProviders } from './hooks'

interface ProviderSelectProps {
  value?: string
  onChange: (id: string | undefined) => void
  /** Only show providers usable for this kind — a "both"-kind provider
   *  satisfies either filter. */
  kind: 'llm' | 'embedding'
  accentClassName?: string
}

export function ProviderSelect({ value, onChange, kind, accentClassName = 'text-teal-600' }: ProviderSelectProps) {
  const { data: allProviders, isLoading } = useLLMProviders()
  const [open, setOpen] = useState(false)

  const providers = useMemo(
    () => (allProviders ?? []).filter((p) => p.kind === kind || p.kind === 'both'),
    [allProviders, kind],
  )
  const selected = useMemo(() => providers.find((p) => p.id === value), [providers, value])
  const isBroken = !!value && !isLoading && !selected

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-8 w-full justify-between gap-2 px-2.5 text-[12px] font-normal',
            !value && 'text-slate-400',
            isBroken && 'border-amber-300',
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Sparkles size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">
              {isLoading && !selected
                ? 'Loading providers…'
                : selected
                  ? selected.name
                  : isBroken
                    ? 'Unavailable provider'
                    : `Select a ${kind} provider…`}
            </span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search providers…" />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
                <Loader2 size={13} className="animate-spin" /> Loading providers…
              </div>
            ) : (
              <>
                <CommandEmpty>No providers found. Add one in Knowledge Bases → Providers.</CommandEmpty>
                <CommandGroup>
                  {providers.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => { onChange(p.id === value ? undefined : p.id); setOpen(false) }}
                    >
                      <Check size={14} className={cn('shrink-0', p.id === value ? `opacity-100 ${accentClassName}` : 'opacity-0')} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{p.name}</span>
                        <span className="truncate font-mono text-[10px] text-slate-400">{p.provider_type} · {p.model}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
