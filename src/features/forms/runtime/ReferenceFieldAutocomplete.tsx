// Searchable async autocomplete for a Form Reference field on Add/Edit
// Record pages — replaces FieldRenderer's plain <select> (which loaded every
// referenced record up front). Follows FormReferenceSelect's Popover+Command
// structural pattern, but searches server-side (debounced) via
// formsApi.searchRecords instead of filtering an already-loaded list.
//
// Display/search field convention, in priority order:
//   1. el.displayField, when configured in the form builder (Config Panel's
//      "Display Field" picker) — an explicit field on the referenced form.
//   2. Otherwise, whichever of `name` or `label` exists on the referenced
//      form's records (legacy heuristic, kept for backward compatibility).
//   3. Otherwise, id with search disabled (list-only, first page).
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, X, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formsApi } from '@/features/forms/api'
import { useForm as useFormDef } from '@/features/forms/hooks'
import type { FormElement } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'
import type { FilterGroup } from '@/features/workflows/types'

function displayLabel(r: FormRecord, field: string | null): string {
  if (field && r[field] != null) return String(r[field])
  return (r.name as string) ?? (r.label as string) ?? (r.id as string)
}

function displayField(hasName: boolean, hasLabel: boolean): string | null {
  if (hasName) return 'name'
  if (hasLabel) return 'label'
  return null
}

function buildContainsFilter(field: string, search: string): FilterGroup {
  return {
    combinator: 'and',
    conditions: [{ id: 'search', field, op: 'contains', value_mode: 'static', value: search }],
    groups: [],
  }
}

interface ReferenceFieldAutocompleteProps {
  el: FormElement
  field: { value: unknown; onChange: (v: unknown) => void }
  disabled: boolean
}

export function ReferenceFieldAutocomplete({ el, field, disabled }: ReferenceFieldAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: targetForm } = useFormDef(el.formRef ?? '')
  const searchField = useMemo(() => {
    if (el.displayField) return el.displayField
    if (!targetForm) return null
    const hasName = targetForm.fields.some((f) => f.name === 'name')
    const hasLabel = targetForm.fields.some((f) => f.name === 'label')
    return displayField(hasName, hasLabel)
  }, [el.displayField, targetForm])

  const { data: results, isLoading } = useQuery({
    queryKey: ['forms', el.formRef, 'reference-options', debouncedSearch],
    queryFn: () =>
      formsApi.searchRecords(el.formRef!, {
        filter: searchField ? buildContainsFilter(searchField, debouncedSearch) : undefined,
        sort: [],
        page: 1,
        page_size: 20,
      }),
    enabled: !!el.formRef && open,
  })

  // Resolve the currently-selected value's display label independently of
  // the search results (e.g. editing an existing record whose reference
  // hasn't been touched yet) — otherwise the combobox would show a raw UUID
  // until the user starts typing.
  const currentValue = (field.value as string) ?? ''
  const { data: currentRecord } = useQuery({
    queryKey: ['forms', el.formRef, 'records', currentValue],
    queryFn: () => formsApi.getRecord(el.formRef!, currentValue),
    enabled: !!el.formRef && !!currentValue,
  })

  if (!el.formRef) return <p className="text-xs text-amber-600">No form configured for this reference.</p>

  const options = results?.records ?? []
  const selectedLabel = currentRecord ? displayLabel(currentRecord, searchField) : currentValue || undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between gap-2 px-2.5 text-[13px] font-normal', !currentValue && 'text-slate-400')}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{selectedLabel ?? 'Search…'}</span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchField ? 'Type to search…' : 'Search unavailable — showing first page'}
            value={search}
            onValueChange={setSearch}
            disabled={!searchField}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
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
                          field.onChange(id === currentValue ? null : id)
                          setOpen(false)
                        }}
                      >
                        <Check size={14} className={cn('shrink-0', id === currentValue ? 'opacity-100 text-indigo-600' : 'opacity-0')} />
                        <span className="truncate">{displayLabel(r, searchField)}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        {currentValue && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-1.5">
            <span className="truncate text-[11px] text-slate-500">{selectedLabel}</span>
            <button
              type="button"
              onClick={() => field.onChange(null)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Clear selection"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
