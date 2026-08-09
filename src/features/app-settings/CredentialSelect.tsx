// A searchable combobox for picking a saved app credential by name —
// extracted from HttpRequestForm's original inline implementation so the
// Knowledge Base form (and any future credential-referencing form) can
// reuse it. Mirrors FormReferenceSelect/KnowledgeBaseSelect's async-picker
// pattern.
import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useCredentials } from './hooks'
import type { CredentialType } from './types'

interface CredentialSelectProps {
  value?: string
  onChange: (name: string | undefined) => void
  /** Restrict the picker to credentials of these type(s) (e.g. "bearer" and
   *  "api_key" both hold a single bare secret, so either works for a plain
   *  API-key reference). Omit to show every credential. */
  typeFilter?: CredentialType | CredentialType[]
  accentClassName?: string
}

export function CredentialSelect({ value, onChange, typeFilter, accentClassName = 'text-cyan-600' }: CredentialSelectProps) {
  const { data: allCredentials, isLoading } = useCredentials()
  const [open, setOpen] = useState(false)

  const allowedTypes = useMemo(
    () => (typeFilter === undefined ? undefined : Array.isArray(typeFilter) ? typeFilter : [typeFilter]),
    [typeFilter],
  )
  const credentials = useMemo(
    () => (allowedTypes ? (allCredentials ?? []).filter((c) => allowedTypes.includes(c.type)) : allCredentials ?? []),
    [allCredentials, allowedTypes],
  )
  const selected = useMemo(() => credentials.find((c) => c.name === value), [credentials, value])
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
            <KeyRound size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">
              {isLoading && !selected
                ? 'Loading credentials…'
                : selected
                  ? selected.name
                  : isBroken
                    ? 'Unavailable credential'
                    : 'Select a credential…'}
            </span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search credentials…" />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
                <Loader2 size={13} className="animate-spin" /> Loading credentials…
              </div>
            ) : (
              <>
                <CommandEmpty>No credentials found. Add one in Application Settings.</CommandEmpty>
                <CommandGroup>
                  {credentials.map((c) => (
                    <CommandItem
                      key={c.name}
                      value={c.name}
                      onSelect={() => { onChange(c.name === value ? undefined : c.name); setOpen(false) }}
                    >
                      <Check size={14} className={cn('shrink-0', c.name === value ? `opacity-100 ${accentClassName}` : 'opacity-0')} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{c.name}</span>
                        <span className="truncate font-mono text-[10px] text-slate-400">{c.type}</span>
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
