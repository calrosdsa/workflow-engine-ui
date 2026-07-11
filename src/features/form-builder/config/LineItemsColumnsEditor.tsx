// The Line Items field's own mini form-builder: a flat list of columns (no
// sections/nesting — a constrained subset of the main canvas). Each column is
// a full FormElement (minus the 'line_items' component itself, enforced by
// LineItemColumnComponent), so it can be projected into the child form's
// FieldDef[] the same way the main canvas projects the parent's elements.
import { useState } from 'react'
import { nanoid } from 'nanoid'
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { cn } from '@/lib/utils'
import { slugifyKey } from '../factory'
import { COMPONENT_REGISTRY, COMPONENT_CATEGORIES, componentsByCategory } from '../component-registry'
import { OptionsEditor } from './OptionsEditor'
import { FormReferenceSelect } from './FormReferenceSelect'
import { DisplayFieldSelect } from './DisplayFieldSelect'
import type { LineItemColumnDef, LineItemColumnComponent } from '../schema'

function emptyColumn(component: LineItemColumnComponent): LineItemColumnDef {
  const reg = COMPONENT_REGISTRY[component]
  const key = `${component}_${nanoid(6)}`
  const col: LineItemColumnDef = {
    id: nanoid(),
    component,
    label: reg.label,
    key,
    validation: {},
    behavior: { visibility: 'always', required: 'optional', readOnly: 'editable' },
  }
  if (['select', 'radio', 'multiselect', 'autocomplete'].includes(component)) {
    col.options = [
      { label: 'Option 1', value: 'option_1' },
      { label: 'Option 2', value: 'option_2' },
    ]
  }
  return col
}

interface LineItemsColumnsEditorProps {
  columns: LineItemColumnDef[]
  onChange: (columns: LineItemColumnDef[]) => void
  /** The parent form's own id, so a reference column can't target itself. */
  excludeFormId?: string
}

export function LineItemsColumnsEditor({ columns, onChange, excludeFormId }: LineItemsColumnsEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(columns[0]?.id ?? null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const update = (id: string, patch: Partial<LineItemColumnDef>) => {
    onChange(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  const remove = (id: string) => onChange(columns.filter((c) => c.id !== id))
  const add = (component: LineItemColumnComponent) => {
    const col = emptyColumn(component)
    onChange([...columns, col])
    setExpanded(col.id)
    setPickerOpen(false)
  }

  return (
    <div className="space-y-2">
      {columns.length === 0 && (
        <p className="text-[11px] text-slate-400">No columns yet — add one below.</p>
      )}

      {columns.map((col) => {
        const reg = COMPONENT_REGISTRY[col.component]
        const Icon = reg.icon
        const isOpen = expanded === col.id
        return (
          <div key={col.id} className="overflow-hidden rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : col.id)}
              className="flex w-full items-center gap-1.5 bg-slate-50 px-2 py-1.5 text-left"
            >
              <GripVertical size={12} className="shrink-0 text-slate-300" />
              {isOpen ? <ChevronDown size={12} className="shrink-0 text-slate-400" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
              <Icon size={12} className="shrink-0 text-indigo-400" />
              <span className="flex-1 truncate text-[12px] font-medium text-slate-700">{col.label || reg.label}</span>
              <span className="font-mono text-[10px] text-slate-400">{col.key}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(col.id) }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                title="Remove column"
              >
                <Trash2 size={11} />
              </button>
            </button>

            {isOpen && (
              <div className="space-y-3 p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-slate-500">Label</Label>
                    <Input value={col.label} onChange={(e) => update(col.id, { label: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-slate-500">Key</Label>
                    <Input
                      value={col.key}
                      onChange={(e) => update(col.id, { key: slugifyKey(e.target.value) })}
                      className="h-7 font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-normal text-slate-600">Required</Label>
                  <Switch
                    checked={col.behavior.required === 'always'}
                    onCheckedChange={(v) => update(col.id, { behavior: { ...col.behavior, required: v ? 'always' : 'optional' } })}
                  />
                </div>

                {['select', 'radio', 'multiselect', 'autocomplete'].includes(col.component) && (
                  <div className="space-y-1">
                    <Label className="text-[10px] font-medium text-slate-500">Options</Label>
                    <OptionsEditor options={col.options ?? []} onChange={(options) => update(col.id, { options })} />
                  </div>
                )}

                {col.component === 'form' && (
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-slate-500">Referenced Form</Label>
                      <FormReferenceSelect
                        value={col.formRef}
                        excludeId={excludeFormId}
                        onChange={(formRef) => update(col.id, { formRef, displayField: undefined })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-slate-500">Display Field</Label>
                      <DisplayFieldSelect
                        formId={col.formRef}
                        value={col.displayField}
                        onChange={(displayField) => update(col.id, { displayField })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => setPickerOpen((v) => !v)} className="w-full gap-1.5 border-dashed text-slate-500">
          <Plus size={12} /> Add Column
        </Button>
        {pickerOpen && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
            {COMPONENT_CATEGORIES.map((cat) => {
              const items = componentsByCategory(cat).filter((c) => c.type !== 'line_items')
              if (items.length === 0) return null
              return (
                <div key={cat} className="mb-1.5 last:mb-0">
                  <p className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{cat}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {items.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.type}
                          onClick={() => add(item.type as LineItemColumnComponent)}
                          className={cn(
                            'flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700',
                          )}
                        >
                          <Icon size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
