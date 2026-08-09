// The Line Items field's own mini form-builder: sections of columns of
// fields — the SAME shape the main canvas uses (see LineItemSection's doc
// comment in schema.ts) — so the row-editor sidebar (LineItemsGrid.tsx) can
// lay a row's fields out multi-column exactly like FormRenderer does for a
// normal form, instead of always stacking one field per row. Unlike the main
// canvas this has no drag-and-drop: it's authored inside a ~320px config
// panel, not a full-width canvas, so each field is placed into a column via
// an explicit picker instead. A field MAY itself be 'line_items' — this
// component then renders itself again for that field's own nested
// sections, recursively and without a depth limit.
import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Columns3, Layers,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { cn } from '@/lib/utils'
import { slugifyKey, createElement, createSection, relayoutSection } from '../factory'
import { COMPONENT_REGISTRY, COMPONENT_CATEGORIES, componentsByCategory } from '../component-registry'
import { OptionsEditor } from './OptionsEditor'
import { FormReferenceSelect } from './FormReferenceSelect'
import { DisplayFieldSelect } from './DisplayFieldSelect'
import { emptyLineItemsConfig, COLUMN_LAYOUTS } from '../schema'
import type { LineItemSection, LineItemColumnComponent, FormElement, ColumnLayout } from '../schema'

interface LineItemsColumnsEditorProps {
  columns: LineItemSection[]
  onChange: (sections: LineItemSection[]) => void
  /** The parent form's own id, so a reference field can't target itself. */
  excludeFormId?: string
}

export function LineItemsColumnsEditor({ columns: sections, onChange, excludeFormId }: LineItemsColumnsEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(sections[0]?.columns[0]?.elements[0]?.id ?? null)
  const [pickerFor, setPickerFor] = useState<string | null>(null) // section id whose "Add Field" picker is open

  const updateSection = (sectionId: string, patch: Partial<LineItemSection>) => {
    onChange(sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)))
  }
  const setSectionLayout = (sectionId: string, layout: ColumnLayout) => {
    onChange(sections.map((s) => (s.id === sectionId ? relayoutSection(s, layout) : s)))
  }
  const removeSection = (sectionId: string) => onChange(sections.filter((s) => s.id !== sectionId))
  const addSection = () => {
    const section = createSection(`Section ${sections.length + 1}`, '1')
    onChange([...sections, section])
  }

  const updateField = (sectionId: string, columnId: string, fieldId: string, patch: Partial<FormElement>) => {
    onChange(sections.map((s) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        columns: s.columns.map((c) => {
          if (c.id !== columnId) return c
          return { ...c, elements: c.elements.map((el) => (el.id === fieldId ? { ...el, ...patch } : el)) }
        }),
      }
    }))
  }
  const removeField = (sectionId: string, columnId: string, fieldId: string) => {
    onChange(sections.map((s) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        columns: s.columns.map((c) => (c.id === columnId ? { ...c, elements: c.elements.filter((el) => el.id !== fieldId) } : c)),
      }
    }))
  }
  /** Moves a field to a different column within the same section — the
   *  stand-in for drag-and-drop given the sidebar's width. */
  const moveField = (sectionId: string, fromColumnId: string, toColumnId: string, fieldId: string) => {
    if (fromColumnId === toColumnId) return
    onChange(sections.map((s) => {
      if (s.id !== sectionId) return s
      const field = s.columns.find((c) => c.id === fromColumnId)?.elements.find((el) => el.id === fieldId)
      if (!field) return s
      return {
        ...s,
        columns: s.columns.map((c) => {
          if (c.id === fromColumnId) return { ...c, elements: c.elements.filter((el) => el.id !== fieldId) }
          if (c.id === toColumnId) return { ...c, elements: [...c.elements, field] }
          return c
        }),
      }
    }))
  }
  const addField = (sectionId: string, columnId: string, component: LineItemColumnComponent) => {
    const field = createElement(component)
    field.key = `${component}_${field.id.slice(0, 6)}`
    if (component === 'line_items') {
      field.lineItemColumns = []
      field.lineItemConfig = emptyLineItemsConfig()
    }
    onChange(sections.map((s) => {
      if (s.id !== sectionId) return s
      return { ...s, columns: s.columns.map((c) => (c.id === columnId ? { ...c, elements: [...c.elements, field] } : c)) }
    }))
    setExpanded(field.id)
    setPickerFor(null)
  }

  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <p className="text-[11px] text-slate-400">No sections yet — add one below.</p>
      )}

      {sections.map((section) => (
        <div key={section.id} className="overflow-hidden rounded-md border border-slate-200">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5">
            <Layers size={12} className="shrink-0 text-slate-400" />
            <Input
              value={section.title}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
              className="h-6 flex-1 border-transparent bg-transparent px-1 text-[12px] font-medium text-slate-700 hover:border-slate-200 focus:border-indigo-300"
            />
            <SelectMenu value={section.layout} onValueChange={(v) => setSectionLayout(section.id, v as ColumnLayout)}>
              <SelectTrigger className="h-6 w-auto gap-1 border-slate-200 px-1.5 text-[10px]">
                <Columns3 size={10} className="text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COLUMN_LAYOUTS) as ColumnLayout[]).map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">{COLUMN_LAYOUTS[key].label}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
            <button
              type="button"
              onClick={() => removeSection(section.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
              title="Remove section"
            >
              <Trash2 size={11} />
            </button>
          </div>

          <div className="space-y-2 p-2">
            <div className={cn('grid gap-2', section.columns.length > 1 && 'grid-cols-2')}>
              {section.columns.map((column) => (
                <div key={column.id} className="space-y-1.5">
                  {section.columns.length > 1 && (
                    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                      Column {section.columns.indexOf(column) + 1}
                    </p>
                  )}
                  {column.elements.map((field) => {
                    const reg = COMPONENT_REGISTRY[field.component]
                    const Icon = reg.icon
                    const isOpen = expanded === field.id
                    return (
                      <div key={field.id} className="overflow-hidden rounded-md border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : field.id)}
                          className="flex w-full items-center gap-1.5 bg-white px-2 py-1.5 text-left"
                        >
                          {isOpen ? <ChevronDown size={11} className="shrink-0 text-slate-400" /> : <ChevronRight size={11} className="shrink-0 text-slate-400" />}
                          <Icon size={11} className="shrink-0 text-indigo-400" />
                          <span className="flex-1 truncate text-[11px] font-medium text-slate-700">{field.label || reg.label}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeField(section.id, column.id, field.id) }}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                            title="Remove field"
                          >
                            <Trash2 size={10} />
                          </button>
                        </button>

                        {isOpen && (
                          <div className="space-y-3 border-t border-slate-100 p-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-slate-500">Label</Label>
                                <Input
                                  value={field.label}
                                  onChange={(e) => updateField(section.id, column.id, field.id, { label: e.target.value })}
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-slate-500">Key</Label>
                                <Input
                                  value={field.key}
                                  onChange={(e) => updateField(section.id, column.id, field.id, { key: slugifyKey(e.target.value) })}
                                  className="h-7 font-mono text-[11px]"
                                />
                              </div>
                            </div>

                            {section.columns.length > 1 && (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-slate-500">Column</Label>
                                <SelectMenu
                                  value={column.id}
                                  onValueChange={(toColumnId) => moveField(section.id, column.id, toColumnId, field.id)}
                                >
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {section.columns.map((c, i) => (
                                      <SelectItem key={c.id} value={c.id} className="text-xs">Column {i + 1}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </SelectMenu>
                              </div>
                            )}

                            {field.component !== 'line_items' && (
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-normal text-slate-600">Required</Label>
                                <Switch
                                  checked={field.behavior.required === 'always'}
                                  onCheckedChange={(v) => updateField(section.id, column.id, field.id, { behavior: { ...field.behavior, required: v ? 'always' : 'optional' } })}
                                />
                              </div>
                            )}

                            {['select', 'radio', 'multiselect', 'autocomplete'].includes(field.component) && (
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-slate-500">Options</Label>
                                <OptionsEditor
                                  options={field.options ?? []}
                                  onChange={(options) => updateField(section.id, column.id, field.id, { options })}
                                />
                              </div>
                            )}

                            {field.component === 'form' && (
                              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-medium text-slate-500">Referenced Form</Label>
                                  <FormReferenceSelect
                                    value={field.formRef}
                                    excludeId={excludeFormId}
                                    onChange={(formRef) => updateField(section.id, column.id, field.id, { formRef, displayField: undefined })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-medium text-slate-500">Display Field</Label>
                                  <DisplayFieldSelect
                                    formId={field.formRef}
                                    value={field.displayField}
                                    onChange={(displayField) => updateField(section.id, column.id, field.id, { displayField })}
                                  />
                                </div>
                              </div>
                            )}

                            {field.component === 'line_items' && (
                              <div className="space-y-1 border-t border-slate-100 pt-3">
                                <Label className="text-[10px] font-medium text-slate-500">Nested Sections</Label>
                                <LineItemsColumnsEditor
                                  columns={field.lineItemColumns ?? []}
                                  onChange={(lineItemColumns) => updateField(section.id, column.id, field.id, { lineItemColumns })}
                                  excludeFormId={excludeFormId}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="relative">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPickerFor(pickerFor === column.id ? null : column.id)}
                      className="h-7 w-full gap-1 border-dashed text-[11px] text-slate-500"
                    >
                      <Plus size={11} /> Add Field
                    </Button>
                    {pickerFor === column.id && (
                      <div className="absolute z-10 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
                        {COMPONENT_CATEGORIES.map((cat) => {
                          const items = componentsByCategory(cat).filter((c) => c.type !== 'line_item_count')
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
                                      onClick={() => addField(section.id, column.id, item.type as LineItemColumnComponent)}
                                      className="flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
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
              ))}
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addSection} className="w-full gap-1.5 border-dashed text-slate-500">
        <Plus size={12} /> Add Section
      </Button>
    </div>
  )
}
