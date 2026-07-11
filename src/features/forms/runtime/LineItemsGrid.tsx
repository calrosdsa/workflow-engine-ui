// Editable grid for a Line Items field — the runtime counterpart to the form
// builder's LineItemsColumnsEditor. Renders one row per child record, with
// add/delete/duplicate/reorder controls gated by the element's LineItemsConfig,
// and per-cell inputs matching FieldRenderer's component-to-input mapping
// (following data-table.tsx's plain-<table> convention; no grid library).
import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { useQuery } from '@tanstack/react-query'
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Copy, Trash2, Check, ChevronsUpDown, Loader2, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import type { FormElement, LineItemColumnDef } from '@/features/form-builder/schema'
import type { FormRecord } from '@/features/forms/types'
import type { FilterGroup } from '@/features/workflows/types'

type Row = FormRecord & { _rowKey: string }

interface LineItemsGridProps {
  el: FormElement
  field: { value: unknown; onChange: (v: unknown) => void }
  disabled: boolean
}

function toRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return []
  return (value as FormRecord[]).map((r) => ({ ...r, _rowKey: (r._rowKey as string) ?? (r.id as string) ?? nanoid() }))
}

function stripRowKey(row: Row): FormRecord {
  const { _rowKey, ...rest } = row
  void _rowKey
  return rest
}

export function LineItemsGrid({ el, field, disabled }: LineItemsGridProps) {
  const cfg = el.lineItemConfig ?? {}
  const columns = el.lineItemColumns ?? []
  const rows = toRows(field.value)

  const canAdd = cfg.allowAddRows !== false && !disabled
  const canDelete = cfg.allowDeleteRows !== false && !disabled
  const canDuplicate = cfg.allowDuplicateRows !== false && !disabled
  const canReorder = cfg.allowReorderRows !== false && !disabled && rows.length > 1
  const atMax = cfg.maxRows !== undefined && rows.length >= cfg.maxRows
  const atMin = cfg.minRows !== undefined && rows.length <= cfg.minRows

  const setRows = (next: Row[]) => field.onChange(next.map(stripRowKey))

  const addRow = () => {
    if (atMax) return
    const blank: Row = { _rowKey: nanoid() }
    setRows([...rows, blank])
  }
  const deleteRow = (rowKey: string) => {
    if (atMin) return
    setRows(rows.filter((r) => r._rowKey !== rowKey))
  }
  const duplicateRow = (rowKey: string) => {
    if (atMax) return
    const idx = rows.findIndex((r) => r._rowKey === rowKey)
    if (idx === -1) return
    const copy: Row = { ...rows[idx], _rowKey: nanoid(), id: undefined }
    setRows([...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)])
  }
  const updateCell = (rowKey: string, key: string, value: unknown) => {
    setRows(rows.map((r) => (r._rowKey === rowKey ? { ...r, [key]: value } : r)))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = rows.findIndex((r) => r._rowKey === active.id)
    const newIndex = rows.findIndex((r) => r._rowKey === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setRows(arrayMove(rows, oldIndex, newIndex))
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 text-[12px] text-slate-400">
        No columns configured for this Line Items field.
      </div>
    )
  }

  const tableStyle = cfg.tableHeight ? { maxHeight: cfg.tableHeight, overflowY: 'auto' as const } : undefined
  const rowPad = cfg.compactMode ? 'py-1' : 'py-2'

  return (
    <div className="space-y-2">
      <div className="overflow-auto rounded-md border border-slate-200" style={tableStyle}>
        <table className="w-full min-w-max text-left text-[12px]">
          <thead className={cn(cfg.stickyHeader !== false && 'sticky top-0 z-10 bg-slate-50')}>
            <tr className="bg-slate-50 text-slate-500">
              {canReorder && <th className="w-6 border-b border-slate-200 px-1" />}
              {columns.map((c) => (
                <th key={c.id} className="border-b border-slate-200 px-2 py-1.5 font-medium">
                  {c.label}
                  {c.behavior.required === 'always' && <span className="ml-0.5 text-red-500">*</span>}
                </th>
              ))}
              {(canDelete || canDuplicate) && <th className="w-16 border-b border-slate-200 px-1" />}
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r._rowKey)} strategy={verticalListSortingStrategy}>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + (canReorder ? 1 : 0) + ((canDelete || canDuplicate) ? 1 : 0)} className="px-2 py-6 text-center text-slate-400">
                      No rows yet.
                    </td>
                  </tr>
                )}
                {rows.map((row, i) => (
                  <GridRow
                    key={row._rowKey}
                    row={row}
                    columns={columns}
                    disabled={disabled}
                    canReorder={canReorder}
                    canDelete={canDelete}
                    canDuplicate={canDuplicate}
                    atMin={atMin}
                    atMax={atMax}
                    rowPad={rowPad}
                    alternate={cfg.alternateRowColors !== false && i % 2 === 1}
                    onCellChange={(key, v) => updateCell(row._rowKey, key, v)}
                    onDelete={() => deleteRow(row._rowKey)}
                    onDuplicate={() => duplicateRow(row._rowKey)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {canAdd && (
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={atMax} className="gap-1.5 border-dashed text-slate-500">
          <Plus size={13} /> Add Row
        </Button>
      )}
      {cfg.maxRows !== undefined && (
        <p className="text-[10px] text-slate-400">{rows.length} / {cfg.maxRows} rows</p>
      )}
    </div>
  )
}

interface GridRowProps {
  row: Row
  columns: LineItemColumnDef[]
  disabled: boolean
  canReorder: boolean
  canDelete: boolean
  canDuplicate: boolean
  atMin: boolean
  atMax: boolean
  rowPad: string
  alternate: boolean
  onCellChange: (key: string, value: unknown) => void
  onDelete: () => void
  onDuplicate: () => void
}

function GridRow({ row, columns, disabled, canReorder, canDelete, canDuplicate, atMin, atMax, rowPad, alternate, onCellChange, onDelete, onDuplicate }: GridRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row._rowKey })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('border-b border-slate-100 last:border-b-0', alternate && 'bg-slate-50/50', isDragging && 'opacity-50')}
    >
      {canReorder && (
        <td className="px-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical size={13} />
          </button>
        </td>
      )}
      {columns.map((c) => (
        <td key={c.id} className={cn('px-1.5', rowPad)}>
          <CellInput column={c} value={row[c.key]} disabled={disabled} onChange={(v) => onCellChange(c.key, v)} />
        </td>
      ))}
      {(canDelete || canDuplicate) && (
        <td className="px-1">
          <div className="flex items-center gap-0.5">
            {canDuplicate && (
              <button type="button" onClick={onDuplicate} disabled={atMax} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30" title="Duplicate row">
                <Copy size={12} />
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={onDelete} disabled={atMin} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30" title="Delete row">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

function CellInput({ column, value, disabled, onChange }: {
  column: LineItemColumnDef
  value: unknown
  disabled: boolean
  onChange: (v: unknown) => void
}) {
  switch (column.component) {
    case 'number':
      return (
        <Input
          type="number"
          value={(value as number | string) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
          className="h-7 w-24 text-xs"
        />
      )
    case 'checkbox':
    case 'switch':
      return <Checkbox checked={!!value} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
    case 'date':
      return <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-7 w-32 text-xs" />
    case 'time':
      return <Input type="time" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-7 w-24 text-xs" />
    case 'datetime':
      return <Input type="datetime-local" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-7 w-40 text-xs" />
    case 'select':
    case 'radio':
      return (
        <Select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-7 w-32 text-xs">
          <option value="">—</option>
          {(column.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )
    case 'form':
      return <CompactReferenceCell column={column} value={value as string} disabled={disabled} onChange={onChange} />
    default:
      return (
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-7 w-32 text-xs"
        />
      )
  }
}

// A compact inline reference cell — same server-side search/debounce/display
// heuristic as ReferenceFieldAutocomplete, just sized to fit a table cell.
function CompactReferenceCell({ column, value, disabled, onChange }: {
  column: LineItemColumnDef
  value: string | undefined
  disabled: boolean
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: targetForm } = useFormDef(column.formRef ?? '')
  const searchField = useMemo(() => {
    if (column.displayField) return column.displayField
    if (!targetForm) return null
    const hasName = targetForm.fields.some((f) => f.name === 'name')
    const hasLabel = targetForm.fields.some((f) => f.name === 'label')
    return hasName ? 'name' : hasLabel ? 'label' : null
  }, [column.displayField, targetForm])

  const { data: results, isLoading } = useQuery({
    queryKey: ['forms', column.formRef, 'reference-options', debouncedSearch],
    queryFn: () =>
      formsApi.searchRecords(column.formRef!, {
        filter: searchField
          ? ({ combinator: 'and', conditions: [{ id: 'search', field: searchField, op: 'contains', value_mode: 'static', value: debouncedSearch }], groups: [] } as FilterGroup)
          : undefined,
        sort: [],
        page: 1,
        page_size: 20,
      }),
    enabled: !!column.formRef && open,
  })

  const { data: currentRecord } = useQuery({
    queryKey: ['forms', column.formRef, 'records', value],
    queryFn: () => formsApi.getRecord(column.formRef!, value!),
    enabled: !!column.formRef && !!value,
  })

  if (!column.formRef) return <span className="text-[11px] text-amber-600">No form configured</span>

  const options = results?.records ?? []
  const displayOf = (r: FormRecord) => (searchField && r[searchField] != null ? String(r[searchField]) : (r.name as string) ?? (r.label as string) ?? (r.id as string))
  const selectedLabel = currentRecord ? displayOf(currentRecord) : value || undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('h-7 w-36 justify-between gap-1 px-2 text-[11px] font-normal', !value && 'text-slate-400')}
        >
          <span className="flex min-w-0 items-center gap-1">
            <FileText size={11} className="shrink-0 text-slate-400" />
            <span className="truncate">{selectedLabel ?? 'Search…'}</span>
          </span>
          <ChevronsUpDown size={11} className="shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type to search…" value={search} onValueChange={setSearch} />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-slate-400">
                <Loader2 size={12} className="animate-spin" /> Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No records found.</CommandEmpty>
                <CommandGroup>
                  {options.map((r) => {
                    const id = r.id as string
                    return (
                      <CommandItem key={id} value={id} onSelect={() => { onChange(id === value ? '' : id); setOpen(false) }}>
                        <Check size={13} className={cn('shrink-0', id === value ? 'opacity-100 text-indigo-600' : 'opacity-0')} />
                        <span className="truncate">{displayOf(r)}</span>
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
