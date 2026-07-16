// A searchable combobox for picking an existing knowledge base to reference
// — mirrors FormReferenceSelect (features/form-builder/config), the
// established "pick a resource by id" pattern in this codebase.

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, AlertTriangle, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useKnowledgeBases } from './hooks'

interface KnowledgeBaseSelectProps {
  /** The currently referenced kb id (or undefined when none). */
  value?: string
  /** Emits the selected kb id, or undefined when cleared. */
  onChange: (kbId: string | undefined) => void
}

export function KnowledgeBaseSelect({ value, onChange }: KnowledgeBaseSelectProps) {
  const { data: kbs, isLoading } = useKnowledgeBases()
  const [open, setOpen] = useState(false)

  const options = useMemo(() => kbs ?? [], [kbs])
  const selected = useMemo(() => (kbs ?? []).find((k) => k.id === value), [kbs, value])
  const isBroken = !!value && !isLoading && !selected

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-8 w-full justify-between gap-2 px-2.5 text-[13px] font-normal',
              !value && 'text-slate-400',
              isBroken && 'border-amber-300',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <BookOpen size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">
                {isLoading && !selected
                  ? 'Loading knowledge bases…'
                  : selected
                    ? selected.name
                    : isBroken
                      ? 'Unavailable knowledge base'
                      : 'Select a knowledge base…'}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder="Search knowledge bases…" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
                  <Loader2 size={13} className="animate-spin" /> Loading knowledge bases…
                </div>
              ) : (
                <>
                  <CommandEmpty>No knowledge bases found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((k) => (
                      <CommandItem
                        key={k.id}
                        value={k.name}
                        onSelect={() => {
                          onChange(k.id === value ? undefined : k.id)
                          setOpen(false)
                        }}
                      >
                        <Check size={14} className={cn('shrink-0', k.id === value ? 'opacity-100 text-indigo-600' : 'opacity-0')} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{k.name}</span>
                          <span className="truncate font-mono text-[10px] text-slate-400">{k.provider}</span>
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

      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
            {isBroken ? (
              <>
                <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                <span className="text-amber-700">Referenced knowledge base is unavailable</span>
              </>
            ) : (
              <>
                <BookOpen size={12} className="shrink-0 text-slate-400" />
                <span className="truncate text-slate-600">{selected?.name ?? value}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            title="Clear selection"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {isBroken && (
        <p className="text-[10px] text-amber-600">
          The stored reference (<span className="font-mono">{value}</span>) no longer matches an existing
          knowledge base. It's preserved until you pick a new one.
        </p>
      )}
    </div>
  )
}
