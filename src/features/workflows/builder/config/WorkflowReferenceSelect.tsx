// A searchable combobox for picking an existing workflow definition to
// reference — mirrors features/form-builder/config/FormReferenceSelect.tsx's
// shape exactly (same Popover/Command combobox, same "displays the name,
// stores the id" contract, same broken-reference handling), just pointed at
// useWorkflows() instead of useForms(). Shared by the Error Trigger's
// source-workflow scoping and the Execute Workflow action node's target
// picker.

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, AlertTriangle, Loader2, Workflow as WorkflowIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useWorkflows } from '../../hooks'

interface WorkflowReferenceSelectProps {
  /** The currently referenced workflow definition id (or undefined when none). */
  value?: string
  /** Emits the selected definition id, or undefined when cleared. */
  onChange: (definitionId: string | undefined) => void
  /** Exclude this definition id from the list (a workflow shouldn't reference itself). */
  excludeId?: string
  placeholder?: string
}

export function WorkflowReferenceSelect({ value, onChange, excludeId, placeholder }: WorkflowReferenceSelectProps) {
  const { data: workflows, isLoading } = useWorkflows()
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () => (workflows ?? []).filter((w) => w.id !== excludeId),
    [workflows, excludeId],
  )

  const selected = useMemo(
    () => (workflows ?? []).find((w) => w.id === value),
    [workflows, value],
  )

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
              !value && 'text-[hsl(var(--muted-foreground))]',
              isBroken && 'border-[hsl(var(--warning))]/50',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <WorkflowIcon size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">
                {isLoading && !selected
                  ? 'Loading workflows…'
                  : selected
                    ? selected.name
                    : isBroken
                      ? 'Unavailable workflow'
                      : (placeholder ?? 'Select a workflow…')}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search workflows…" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <Loader2 size={13} className="animate-spin" /> Loading workflows…
                </div>
              ) : (
                <>
                  <CommandEmpty>No workflows found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((w) => (
                      <CommandItem
                        key={w.id}
                        value={w.name}
                        onSelect={() => {
                          onChange(w.id === value ? undefined : w.id)
                          setOpen(false)
                        }}
                      >
                        <Check
                          size={14}
                          className={cn('shrink-0', w.id === value ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')}
                        />
                        <span className="truncate">{w.name}</span>
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
        <div className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
            {isBroken ? (
              <>
                <AlertTriangle size={12} className="shrink-0 text-[hsl(var(--warning))]" />
                <span className="text-[hsl(var(--warning))]">Referenced workflow is unavailable</span>
              </>
            ) : (
              <>
                <WorkflowIcon size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span className="truncate text-[hsl(var(--muted-foreground))]">{selected?.name ?? value}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            title="Clear selection"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {isBroken && (
        <p className="text-[10px] text-[hsl(var(--warning))]">
          The stored reference (<span className="font-mono">{value}</span>) no longer matches an existing
          workflow. It's preserved until you pick a new one.
        </p>
      )}
    </div>
  )
}
