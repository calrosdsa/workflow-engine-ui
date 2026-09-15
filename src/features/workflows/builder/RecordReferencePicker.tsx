// Searchable record combobox for a workflow field-value row whose target
// field is type === 'reference' — the FieldDef-driven counterpart to
// features/forms/runtime/ReferenceFieldAutocomplete.tsx (which is driven by
// a form-builder FormElement instead). Reuses the same search/label
// resolution helpers so a reference picked here resolves to the identical
// label a user would see on the Add/Edit Record page.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, X, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formsApi } from '@/features/forms/api'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { resolveReferenceLabel } from '@/features/forms/runtime/record-title'
import { useI18n } from '@/features/i18n/I18nProvider'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup } from '../types'

function buildContainsFilter(field: string, search: string): FilterGroup {
  return {
    combinator: 'and',
    conditions: [{ id: 'search', field, op: 'contains', value_mode: 'static', value: search }],
    groups: [],
  }
}

interface RecordReferencePickerProps {
  field: FieldDef
  value: string
  onChange: (id: string | null) => void
  disabled?: boolean
}

export function RecordReferencePicker({ field, value, onChange, disabled }: RecordReferencePickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const targetFormId = field.reference_table ?? ''
  const { data: targetForm } = useFormDef(targetFormId)
  const searchField = field.display_field
    ?? (targetForm?.fields.some((f) => f.name === 'name') ? 'name'
      : targetForm?.fields.some((f) => f.name === 'label') ? 'label'
      : null)

  const { data: results, isLoading } = useQuery({
    queryKey: ['forms', targetFormId, 'reference-options', debouncedSearch],
    queryFn: () =>
      formsApi.searchRecords(targetFormId, {
        filter: searchField ? buildContainsFilter(searchField, debouncedSearch) : undefined,
        sort: [],
        page: 1,
        page_size: 20,
      }),
    enabled: !!targetFormId && open,
  })

  const { data: currentRecord } = useQuery({
    queryKey: ['forms', targetFormId, 'records', value],
    queryFn: () => formsApi.getRecord(targetFormId, value),
    enabled: !!targetFormId && !!value,
  })

  if (!targetFormId) return <p className="text-[11px] text-[hsl(var(--warning))]">{t('workflows.builder.no_target_form')}</p>

  const options = results?.records ?? []
  const selectedLabel = currentRecord ? resolveReferenceLabel(targetForm?.fields, currentRecord, field.display_field) : value || undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-7 min-w-0 flex-1 justify-between gap-1.5 px-2 text-[12px] font-normal', !value && 'text-[hsl(var(--muted-foreground))]')}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="truncate">{selectedLabel ?? t('workflows.builder.search')}</span>
          </span>
          <ChevronsUpDown size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchField ? t('workflows.builder.type_to_search') : t('workflows.builder.search_unavailable')}
            value={search}
            onValueChange={setSearch}
            disabled={!searchField}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                <Loader2 size={13} className="animate-spin" /> {t('workflows.builder.searching')}
              </div>
            ) : (
              <>
                <CommandEmpty>{t('workflows.builder.no_records')}</CommandEmpty>
                <CommandGroup>
                  {options.map((r) => {
                    const id = r.id as string
                    return (
                      <CommandItem
                        key={id}
                        value={id}
                        onSelect={() => {
                          onChange(id === value ? null : id)
                          setOpen(false)
                        }}
                      >
                        <Check size={14} className={cn('shrink-0', id === value ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                        <span className="truncate">{resolveReferenceLabel(targetForm?.fields, r, field.display_field)}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {value && (
          <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--border))] px-2.5 py-1.5">
            <span className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{selectedLabel}</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              title={t('workflows.builder.clear_selection')}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
