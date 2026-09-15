// A searchable combobox for picking an existing Agent (FR-F6-001) to
// target — mirrors WorkflowReferenceSelect.tsx's shape exactly (same
// Popover/Command combobox, same "displays the name, stores the id"
// contract, same broken-reference handling), just pointed at useAgents()
// instead of useWorkflows(). Used by the Run Agent node's target picker
// (FR-C5-013).

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, AlertTriangle, Loader2, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useAgents } from '@/features/agents/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface AgentSelectProps {
  /** The currently referenced Agent id (or undefined when none). */
  value?: string
  /** Emits the selected Agent id, or undefined when cleared. */
  onChange: (agentId: string | undefined) => void
  placeholder?: string
}

export function AgentSelect({ value, onChange, placeholder }: AgentSelectProps) {
  const t = useTranslation()
  const { data: agents, isLoading } = useAgents()
  const [open, setOpen] = useState(false)

  const options = useMemo(() => agents ?? [], [agents])
  const selected = useMemo(() => (agents ?? []).find((a) => a.id === value), [agents, value])
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
              <Bot size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="truncate">
                {isLoading && !selected
                  ? t('workflows.builder.loading_agents')
                  : selected
                    ? selected.name
                    : isBroken
                      ? t('workflows.builder.unavailable_agent')
                      : (placeholder ?? t('workflows.builder.select_agent_placeholder'))}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder={t('workflows.builder.search_agents_placeholder')} />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <Loader2 size={13} className="animate-spin" /> {t('workflows.builder.loading_agents')}
                </div>
              ) : options.length === 0 ? (
                <CommandEmpty>{t('workflows.builder.no_agents')}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {options.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={a.name}
                      onSelect={() => {
                        onChange(a.id === value ? undefined : a.id)
                        setOpen(false)
                      }}
                    >
                      <Check size={14} className={cn('shrink-0', a.id === value ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                      <span className="truncate">{a.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
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
                <span className="text-[hsl(var(--warning))]">{t('workflows.builder.agent_unavailable_warning')}</span>
              </>
            ) : (
              <>
                <Bot size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span className="truncate text-[hsl(var(--muted-foreground))]">{selected?.name ?? value}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            title={t('workflows.builder.clear_selection')}
          >
            <X size={12} />
          </button>
        </div>
      )}
      {isBroken && (
        <p className="text-[10px] text-[hsl(var(--warning))]">
          {t('workflows.builder.stored_reference_prefix')}<span className="font-mono">{value}</span>{t('workflows.builder.stored_reference_agent_suffix')}
        </p>
      )}
    </div>
  )
}
