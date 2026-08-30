// A searchable combobox for picking one enabled model, across every
// configured Provider Instance, filtered by capability — mirrors
// app-settings/CredentialSelect.tsx's async-picker pattern exactly, same as
// this component's predecessor (ProviderSelect.tsx, which picked a whole
// Provider row back when one row was exactly one model). Now that a single
// Instance can expose several models, the meaningful unit to pick is the
// model, not the Instance — so this returns a model_id, not an instance_id.
import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useAllProviderModels } from './hooks'
import type { Capability } from './types'

interface ModelPickerProps {
  value?: string
  onChange: (modelId: string | undefined) => void
  capability: Capability
  accentClassName?: string
}

export function ModelPicker({ value, onChange, capability, accentClassName = 'text-[hsl(var(--primary))]' }: ModelPickerProps) {
  const { data: allModels, isLoading } = useAllProviderModels()
  const [open, setOpen] = useState(false)

  const models = useMemo(
    () => (allModels ?? []).filter((m) => m.capability === capability && m.enabled),
    [allModels, capability],
  )
  const selected = useMemo(() => models.find((m) => m.id === value), [models, value])
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
            !value && 'text-[hsl(var(--muted-foreground))]',
            isBroken && 'border-[hsl(var(--warning))]',
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Sparkles size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="truncate">
              {isLoading && !selected
                ? 'Loading models…'
                : selected
                  ? `${selected.instance_name} · ${selected.model}`
                  : isBroken
                    ? 'Unavailable model'
                    : `Select a ${capability} model…`}
            </span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search models…" />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                <Loader2 size={13} className="animate-spin" /> Loading models…
              </div>
            ) : (
              <>
                <CommandEmpty>No models found. Add a provider in Model Providers.</CommandEmpty>
                <CommandGroup>
                  {models.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={`${m.instance_name} ${m.model}`}
                      onSelect={() => { onChange(m.id === value ? undefined : m.id); setOpen(false) }}
                    >
                      <Check size={14} className={cn('shrink-0', m.id === value ? `opacity-100 ${accentClassName}` : 'opacity-0')} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{m.instance_name}</span>
                        <span className="truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{m.provider_type} · {m.model}</span>
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
