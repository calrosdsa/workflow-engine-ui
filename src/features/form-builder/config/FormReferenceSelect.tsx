// A searchable combobox for picking an existing form to reference.
//
// Always DISPLAYS the selected form's name, but the value it stores (and emits
// via onChange) is the form's unique id. Built on shadcn Popover + cmdk Command
// for search, keyboard navigation, loading/empty states, and accessibility.

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, X, AlertTriangle, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useForms } from '@/features/forms/hooks'

interface FormReferenceSelectProps {
  /** The currently referenced form id (or undefined when none). */
  value?: string
  /** Emits the selected form id, or undefined when cleared. */
  onChange: (formId: string | undefined) => void
  /** Exclude this form id from the list (a form shouldn't reference itself). */
  excludeId?: string
  /** When set, only list forms that have at least one 'reference'-type field
   *  whose reference_table points at this form id — i.e. forms that could
   *  actually be adopted as a Line Items child of it. Used by the adopted
   *  Line Items "Form" picker so you can't pick an unrelated form and only
   *  discover the mismatch afterward in the reference-field picker. */
  requireReferenceTo?: string
}

export function FormReferenceSelect({ value, onChange, excludeId, requireReferenceTo }: FormReferenceSelectProps) {
  const { data: forms, isLoading } = useForms()
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () => (forms ?? []).filter((f) => {
      if (f.id === excludeId) return false
      if (requireReferenceTo && !f.fields.some((fd) => fd.type === 'reference' && fd.reference_table === requireReferenceTo)) return false
      return true
    }),
    [forms, excludeId, requireReferenceTo],
  )

  const selected = useMemo(
    () => (forms ?? []).find((f) => f.id === value),
    [forms, value],
  )

  // A stored reference whose form no longer exists (deleted/unavailable). We
  // keep the id but surface a warning so the user can re-point it.
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
              <FileText size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">
                {isLoading && !selected
                  ? 'Loading forms…'
                  : selected
                    ? selected.name
                    : isBroken
                      ? 'Unavailable form'
                      : 'Select a form…'}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder="Search forms…" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
                  <Loader2 size={13} className="animate-spin" /> Loading forms…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {requireReferenceTo
                      ? 'No forms with a reference field pointing back at this form. Add one on the target form first.'
                      : 'No forms found.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {options.map((f) => (
                      <CommandItem
                        key={f.id}
                        // cmdk searches on `value`; include the name so search works.
                        value={`${f.name} ${f.slug}`}
                        onSelect={() => {
                          onChange(f.id === value ? undefined : f.id)
                          setOpen(false)
                        }}
                      >
                        <Check
                          size={14}
                          className={cn('shrink-0', f.id === value ? 'opacity-100 text-indigo-600' : 'opacity-0')}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">{f.name}</span>
                          <span className="truncate font-mono text-[10px] text-slate-400">{f.slug}</span>
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

      {/* Selected form display + clear action */}
      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
            {isBroken ? (
              <>
                <AlertTriangle size={12} className="shrink-0 text-amber-500" />
                <span className="text-amber-700">Referenced form is unavailable</span>
              </>
            ) : (
              <>
                <FileText size={12} className="shrink-0 text-slate-400" />
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
          form. It's preserved until you pick a new one.
        </p>
      )}
    </div>
  )
}
