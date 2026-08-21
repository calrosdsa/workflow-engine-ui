// A Reference field's Filter Value input — searches the referenced form's
// own records and stores the picked record's id, the same way
// ReferenceFieldAutocomplete.tsx does for an Add/Edit Record page's own
// reference field. Deliberately a separate, smaller component rather than
// reusing that one directly: it's built around FormElement/react-hook-form's
// field shape (form-builder-authored elements), while a filter condition's
// value only ever has a FieldDef (name/type/reference_table/display_field)
// and a plain onChange(value) callback — forcing one shape into the other
// would need more adapter code than this small, focused rewrite does.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formsApi } from '@/features/forms/api'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { resolveReferenceLabel } from '@/features/forms/runtime/record-title'
import type { FieldDef } from '@/features/forms/types'
import type { FilterGroup } from '../types'

function buildContainsFilter(field: string, search: string): FilterGroup {
  return { combinator: 'and', conditions: [{ id: 'search', field, op: 'contains', value_mode: 'static', value: search }], groups: [] }
}

interface FilterReferenceValuePickerProps {
  targetFormId: string
  displayField?: string
  value: string
  onChange: (v: string) => void
  className?: string
}

export function FilterReferenceValuePicker({ targetFormId, displayField, value, onChange, className }: FilterReferenceValuePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: targetForm } = useFormDef(targetFormId)
  const searchField = displayField
    ?? (targetForm?.fields.some((f) => f.name === 'name') ? 'name'
      : targetForm?.fields.some((f) => f.name === 'label') ? 'label'
      : null)

  const { data: results, isLoading } = useQuery({
    queryKey: ['forms', targetFormId, 'filter-reference-options', debouncedSearch],
    queryFn: () => formsApi.searchRecords(targetFormId, {
      filter: searchField ? buildContainsFilter(searchField, debouncedSearch) : undefined,
      sort: [],
      page: 1,
      page_size: 20,
    }),
    enabled: !!targetFormId && open,
  })

  // Resolves the already-picked value's label even before the popover is
  // ever opened (e.g. loading a saved view whose filter already names a
  // record) — otherwise the trigger would show the raw id until opened.
  const { data: currentRecord } = useQuery({
    queryKey: ['forms', targetFormId, 'records', value],
    queryFn: () => formsApi.getRecord(targetFormId, value),
    enabled: !!targetFormId && !!value,
  })

  const options = results?.records ?? []
  const selectedLabel = currentRecord ? resolveReferenceLabel(targetForm?.fields as FieldDef[] | undefined, currentRecord, displayField) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-7 justify-between gap-1.5 px-2 text-[12px] font-normal', !value && 'text-[hsl(var(--muted-foreground))]', className)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
            <span className="truncate">{selectedLabel ?? (value || 'select record…')}</span>
          </span>
          <ChevronsUpDown size={12} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        container={document.getElementById('runtime-root') ?? document.body}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchField ? 'Type to search…' : 'Search unavailable — showing first page'}
            value={search}
            onValueChange={setSearch}
            disabled={!searchField}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[hsl(var(--muted-foreground))]">
                <Loader2 size={13} className="animate-spin" /> Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No records found.</CommandEmpty>
                <CommandGroup>
                  {options.map((r) => {
                    const id = r.id as string
                    return (
                      <CommandItem
                        key={id}
                        value={id}
                        onSelect={() => {
                          onChange(id === value ? '' : id)
                          setOpen(false)
                        }}
                      >
                        <Check size={14} className={cn('shrink-0', id === value ? 'opacity-100 text-[hsl(var(--primary))]' : 'opacity-0')} />
                        <span className="truncate">{resolveReferenceLabel(targetForm?.fields as FieldDef[] | undefined, r, displayField)}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
