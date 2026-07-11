import { SlidersHorizontal, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { cn } from '@/lib/utils'
import { useFormBuilderStore, useFormMetaStore } from '../store'
import { COMPONENT_REGISTRY, supportsUnique } from '../component-registry'
import { slugifyKey } from '../factory'
import {
  type FormElement, type VisibilityMode, type RequiredMode, type ReadOnlyMode,
  type ElementValidation, type ElementBehavior, type ElementAppearance, type BindingSource,
} from '../schema'
import { ExpressionField } from './ExpressionField'
import { OptionsEditor } from './OptionsEditor'
import { FormReferenceSelect } from './FormReferenceSelect'
import { DisplayFieldSelect } from './DisplayFieldSelect'
import { LineItemsColumnsEditor } from './LineItemsColumnsEditor'
import type { LineItemsConfig } from '../schema'
import type { VariableDecl } from '@/features/workflows/types'

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-slate-600">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[12px] font-normal text-slate-600">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ConfigPanel({ variables }: { variables: VariableDecl[] }) {
  const schema = useFormBuilderStore((s) => s.schema)
  const formId = useFormMetaStore((s) => s.formId)
  const selectedElementId = useFormBuilderStore((s) => s.selectedItemId)
  const selectedSectionId = useFormBuilderStore((s) => s.selectedSectionId)
  const updateElement = useFormBuilderStore((s) => s.updateItem)
  const updateSection = useFormBuilderStore((s) => s.updateSection)

  // Find selected element
  let element: FormElement | null = null
  for (const section of schema.sections) {
    for (const column of section.columns) {
      const found = column.elements.find((e) => e.id === selectedElementId)
      if (found) { element = found; break }
    }
    if (element) break
  }
  const section = schema.sections.find((s) => s.id === selectedSectionId) ?? null

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      {element ? (
        <ElementConfig element={element} variables={variables} formId={formId} onChange={(p) => updateElement(element!.id, p)} />
      ) : section ? (
        <SectionConfig
          key={section.id}
          title={section.title}
          description={section.description ?? ''}
          onChange={(p) => updateSection(section.id, p)}
        />
      ) : (
        <EmptyConfig />
      )}
    </aside>
  )
}

function EmptyConfig() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <SlidersHorizontal size={22} className="text-slate-300" />
      </div>
      <p className="text-sm text-slate-400">Select a field or section<br />to configure it</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

function SectionConfig({ title, description, onChange }: {
  title: string; description: string
  onChange: (p: { title?: string; description?: string }) => void
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-600 to-slate-700 px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
          <Layers size={17} className="text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white">Section</p>
          <p className="text-[10px] text-white/60">Layout container</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <Field label="Section Title">
          <Input value={title} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-sm" />
        </Field>
        <Field label="Description" hint="Optional helper text shown under the title.">
          <Textarea value={description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className="text-sm" />
        </Field>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Element config (tabbed)
// ---------------------------------------------------------------------------

function ElementConfig({ element, variables, formId, onChange }: {
  element: FormElement
  variables: VariableDecl[]
  formId: string | null
  onChange: (patch: Partial<FormElement>) => void
}) {
  const reg = COMPONENT_REGISTRY[element.component]
  const Icon = reg.icon

  const setValidation = (patch: Partial<ElementValidation>) => onChange({ validation: { ...element.validation, ...patch } })
  const setBehavior = (patch: Partial<ElementBehavior>) => onChange({ behavior: { ...element.behavior, ...patch } })
  const setAppearance = (patch: Partial<ElementAppearance>) => onChange({ appearance: { ...element.appearance, ...patch } })
  const setBinding = (patch: Partial<FormElement['binding']>) => onChange({ binding: { ...element.binding, ...patch } })

  const isPresentational = !reg.dataBearing
  const hasOptions = ['select', 'radio', 'multiselect', 'autocomplete'].includes(element.component)
  const isNumeric = element.component === 'number'
  const isTextual = ['text', 'textarea', 'email', 'url', 'password', 'phone'].includes(element.component)
  const isFormRef = element.component === 'form'
  const isLineItems = element.component === 'line_items'
  const canBeUnique = supportsUnique(element.component)

  const header = (
    <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
        <Icon size={17} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-white">{reg.label}</p>
        <p className="truncate font-mono text-[10px] text-white/60">{element.key}</p>
      </div>
    </div>
  )

  if (isLineItems) {
    return (
      <>
        {header}
        <LineItemsConfigTabs element={element} formId={formId} onChange={onChange} />
      </>
    )
  }

  return (
    <>
      {header}

      <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-100 px-3 pb-2 pt-2.5">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1 text-[11px]">General</TabsTrigger>
            {!isPresentational && <TabsTrigger value="validation" className="flex-1 text-[11px]">Rules</TabsTrigger>}
            {!isPresentational && <TabsTrigger value="behavior" className="flex-1 text-[11px]">Logic</TabsTrigger>}
            <TabsTrigger value="appearance" className="flex-1 text-[11px]">Style</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* GENERAL */}
            <TabsContent value="general" className="mt-0 space-y-4">
              {isPresentational && reg.configPanel ? (
                <reg.configPanel element={element} onChange={onChange} />
              ) : (
                <>
                  <Field label="Label">
                    <Input value={element.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
                  </Field>
                  <Field label="Field Name / Key" hint="Machine name — becomes the data column.">
                    <Input
                      value={element.key}
                      onChange={(e) => onChange({ key: slugifyKey(e.target.value) })}
                      className="h-8 font-mono text-[12px]"
                    />
                  </Field>
                  <Field label="Description">
                    <Input value={element.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} placeholder="Shown under the label" className="h-8 text-sm" />
                  </Field>
                  {!hasOptions && !isFormRef && element.component !== 'checkbox' && element.component !== 'switch' && (
                    <Field label="Placeholder">
                      <Input value={element.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })} className="h-8 text-sm" />
                    </Field>
                  )}
                  <Field label="Help Text" hint="Hint shown below the field.">
                    <Input value={element.helpText ?? ''} onChange={(e) => onChange({ helpText: e.target.value })} className="h-8 text-sm" />
                  </Field>
                  {hasOptions && (
                    <Field label="Options">
                      <OptionsEditor options={element.options ?? []} onChange={(options) => onChange({ options })} />
                    </Field>
                  )}
                  {isFormRef && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Form Reference</p>
                      <Field label="Referenced Form" hint="Stores the form's id; displays its name.">
                        <FormReferenceSelect
                          value={element.formRef}
                          excludeId={formId ?? undefined}
                          onChange={(formRef) => onChange({ formRef, displayField: undefined })}
                        />
                      </Field>
                      <Field label="Display Field" hint="Which field of the referenced form to show in the dropdown and use for search.">
                        <DisplayFieldSelect
                          formId={element.formRef}
                          value={element.displayField}
                          onChange={(displayField) => onChange({ displayField })}
                        />
                      </Field>
                    </div>
                  )}
                  {!isFormRef && (
                    <Field label="Default Value">
                      <Input
                        value={element.defaultValue == null ? '' : String(element.defaultValue)}
                        onChange={(e) => onChange({ defaultValue: e.target.value })}
                        placeholder="Static default"
                        className="h-8 text-sm"
                      />
                    </Field>
                  )}
                </>
              )}
            </TabsContent>

            {/* VALIDATION */}
            {!isPresentational && (
              <TabsContent value="validation" className="mt-0 space-y-4">
                <ToggleRow
                  label="Required"
                  checked={element.behavior.required === 'always'}
                  onCheckedChange={(v) => setBehavior({ required: v ? 'always' : 'optional' })}
                />
                {canBeUnique && (
                  <div className="space-y-1">
                    <ToggleRow
                      label="Unique"
                      checked={!!element.unique}
                      onCheckedChange={(v) => onChange({ unique: v })}
                    />
                    <p className="text-[10px] text-slate-400">No two records may share this value.</p>
                  </div>
                )}
                {isTextual && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Min Length">
                      <Input type="number" value={element.validation.minLength ?? ''} onChange={(e) => setValidation({ minLength: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                    <Field label="Max Length">
                      <Input type="number" value={element.validation.maxLength ?? ''} onChange={(e) => setValidation({ maxLength: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                  </div>
                )}
                {isNumeric && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Min Value">
                      <Input type="number" value={element.validation.min ?? ''} onChange={(e) => setValidation({ min: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                    <Field label="Max Value">
                      <Input type="number" value={element.validation.max ?? ''} onChange={(e) => setValidation({ max: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                  </div>
                )}
                {isTextual && (
                  <Field label="Regex Pattern" hint="e.g. ^[A-Z]{2}\d{4}$">
                    <Input value={element.validation.pattern ?? ''} onChange={(e) => setValidation({ pattern: e.target.value })} className="h-8 font-mono text-[11px]" />
                  </Field>
                )}
                <Field label="Custom Validation Message">
                  <Input value={element.validation.customMessage ?? ''} onChange={(e) => setValidation({ customMessage: e.target.value })} placeholder="Shown when invalid" className="h-8 text-sm" />
                </Field>
              </TabsContent>
            )}

            {/* BEHAVIOR */}
            {!isPresentational && (
              <TabsContent value="behavior" className="mt-0 space-y-5">
                {/* Visibility */}
                <RuleGroup
                  title="Visibility"
                  mode={element.behavior.visibility}
                  options={[['always', 'Always Visible'], ['hidden', 'Hidden'], ['expression', 'Visible When']]}
                  onModeChange={(m) => setBehavior({ visibility: m as VisibilityMode })}
                  expression={element.behavior.visibleWhen ?? ''}
                  onExpressionChange={(v) => setBehavior({ visibleWhen: v })}
                  showExpression={element.behavior.visibility === 'expression'}
                  variables={variables}
                  exprLabel="visible when"
                />
                {/* Required */}
                <RuleGroup
                  title="Mandatory"
                  mode={element.behavior.required}
                  options={[['always', 'Always Required'], ['optional', 'Optional'], ['expression', 'Required When']]}
                  onModeChange={(m) => setBehavior({ required: m as RequiredMode })}
                  expression={element.behavior.requiredWhen ?? ''}
                  onExpressionChange={(v) => setBehavior({ requiredWhen: v })}
                  showExpression={element.behavior.required === 'expression'}
                  variables={variables}
                  exprLabel="required when"
                />
                {/* Read Only */}
                <RuleGroup
                  title="Read Only"
                  mode={element.behavior.readOnly}
                  options={[['editable', 'Editable'], ['always', 'Always Read Only'], ['expression', 'Read Only When']]}
                  onModeChange={(m) => setBehavior({ readOnly: m as ReadOnlyMode })}
                  expression={element.behavior.readOnlyWhen ?? ''}
                  onExpressionChange={(v) => setBehavior({ readOnlyWhen: v })}
                  showExpression={element.behavior.readOnly === 'expression'}
                  variables={variables}
                  exprLabel="read-only when"
                />

                <div className="h-px bg-slate-100" />
                <ToggleRow label="Disabled" checked={!!element.behavior.disabled} onCheckedChange={(v) => setBehavior({ disabled: v })} />
                <Field label="Dynamic Default Value" hint="Expression computed when the form loads.">
                  <ExpressionField
                    value={element.behavior.dynamicDefault ?? ''}
                    onChange={(v) => setBehavior({ dynamicDefault: v })}
                    variables={variables}
                    placeholder='e.g. now()'
                    label="dynamic default"
                  />
                </Field>

                <div className="h-px bg-slate-100" />
                {/* Data binding */}
                <Field label="Data Binding" hint="Where this field's value comes from.">
                  <SelectMenu value={element.binding.source} onValueChange={(v) => setBinding({ source: v as BindingSource })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">None (user input)</SelectItem>
                      <SelectItem value="form_field" className="text-xs">Form Field</SelectItem>
                      <SelectItem value="workflow_variable" className="text-xs">Workflow Variable</SelectItem>
                      <SelectItem value="expression" className="text-xs">Computed (Expression)</SelectItem>
                      <SelectItem value="option_source" className="text-xs">Dynamic Option Source</SelectItem>
                    </SelectContent>
                  </SelectMenu>
                </Field>
                {(element.binding.source === 'form_field' || element.binding.source === 'workflow_variable') && (
                  <Field label="Reference">
                    <Input value={element.binding.ref ?? ''} onChange={(e) => setBinding({ ref: e.target.value })} placeholder="name" className="h-8 font-mono text-[12px]" />
                  </Field>
                )}
                {element.binding.source === 'expression' && (
                  <Field label="Computed Value">
                    <ExpressionField value={element.binding.expression ?? ''} onChange={(v) => setBinding({ expression: v })} variables={variables} label="computed value" />
                  </Field>
                )}
                {element.binding.source === 'option_source' && (
                  <Field label="Option Source" hint="Named source (future API-backed).">
                    <Input value={element.binding.optionSource ?? ''} onChange={(e) => setBinding({ optionSource: e.target.value })} placeholder="e.g. countries" className="h-8 text-sm" />
                  </Field>
                )}
              </TabsContent>
            )}

            {/* APPEARANCE */}
            <TabsContent value="appearance" className="mt-0 space-y-4">
              <Field label="Width">
                <SelectMenu value={element.appearance.width ?? 'full'} onValueChange={(v) => setAppearance({ width: v as ElementAppearance['width'] })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full" className="text-xs">Full width</SelectItem>
                    <SelectItem value="half" className="text-xs">Half (50%)</SelectItem>
                    <SelectItem value="third" className="text-xs">Third (33%)</SelectItem>
                    <SelectItem value="quarter" className="text-xs">Quarter (25%)</SelectItem>
                    <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                  </SelectContent>
                </SelectMenu>
              </Field>
              <Field label="Responsive Column Span" hint="1–12 grid columns.">
                <Input type="number" min={1} max={12} value={element.appearance.colSpan ?? ''} onChange={(e) => setAppearance({ colSpan: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
              {!isPresentational && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Prefix"><Input value={element.appearance.prefix ?? ''} onChange={(e) => setAppearance({ prefix: e.target.value })} placeholder="$" className="h-8 text-sm" /></Field>
                  <Field label="Suffix"><Input value={element.appearance.suffix ?? ''} onChange={(e) => setAppearance({ suffix: e.target.value })} placeholder=".00" className="h-8 text-sm" /></Field>
                </div>
              )}
              <Field label="Tooltip">
                <Input value={element.appearance.tooltip ?? ''} onChange={(e) => setAppearance({ tooltip: e.target.value })} className="h-8 text-sm" />
              </Field>
              <Field label="CSS Class" hint="Optional custom class names.">
                <Input value={element.appearance.cssClass ?? ''} onChange={(e) => setAppearance({ cssClass: e.target.value })} className="h-8 font-mono text-[11px]" />
              </Field>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </>
  )
}

// ---------------------------------------------------------------------------
// Line Items config (General / Layout / Behavior / Columns)
// ---------------------------------------------------------------------------

function LineItemsConfigTabs({ element, formId, onChange }: {
  element: FormElement
  formId: string | null
  onChange: (patch: Partial<FormElement>) => void
}) {
  const cfg: LineItemsConfig = element.lineItemConfig ?? {}
  const setConfig = (patch: Partial<LineItemsConfig>) => onChange({ lineItemConfig: { ...cfg, ...patch } })

  return (
    <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-100 px-3 pb-2 pt-2.5">
        <TabsList className="w-full">
          <TabsTrigger value="general" className="flex-1 text-[11px]">General</TabsTrigger>
          <TabsTrigger value="layout" className="flex-1 text-[11px]">Layout</TabsTrigger>
          <TabsTrigger value="behavior" className="flex-1 text-[11px]">Behavior</TabsTrigger>
          <TabsTrigger value="columns" className="flex-1 text-[11px]">Columns</TabsTrigger>
        </TabsList>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* GENERAL */}
          <TabsContent value="general" className="mt-0 space-y-4">
            <Field label="Label">
              <Input value={element.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
            </Field>
            <Field label="Internal Name / Key" hint="Machine name — becomes the nested records key.">
              <Input value={element.key} onChange={(e) => onChange({ key: slugifyKey(e.target.value) })} className="h-8 font-mono text-[12px]" />
            </Field>
            <Field label="Description">
              <Input value={element.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} placeholder="Shown under the label" className="h-8 text-sm" />
            </Field>
            <ToggleRow
              label="Required"
              checked={element.behavior.required === 'always'}
              onCheckedChange={(v) => onChange({ behavior: { ...element.behavior, required: v ? 'always' : 'optional' } })}
            />
            <ToggleRow
              label="Read Only"
              checked={element.behavior.readOnly === 'always'}
              onCheckedChange={(v) => onChange({ behavior: { ...element.behavior, readOnly: v ? 'always' : 'editable' } })}
            />
            <ToggleRow
              label="Hidden"
              checked={element.behavior.visibility === 'hidden'}
              onCheckedChange={(v) => onChange({ behavior: { ...element.behavior, visibility: v ? 'hidden' : 'always' } })}
            />
          </TabsContent>

          {/* LAYOUT */}
          <TabsContent value="layout" className="mt-0 space-y-4">
            <Field label="Table Height (px)" hint="Leave blank to grow with content.">
              <Input
                type="number"
                value={cfg.tableHeight ?? ''}
                onChange={(e) => setConfig({ tableHeight: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </Field>
            <ToggleRow label="Allow Column Resize" checked={cfg.allowResize !== false} onCheckedChange={(v) => setConfig({ allowResize: v })} />
            <ToggleRow label="Sticky Header" checked={cfg.stickyHeader !== false} onCheckedChange={(v) => setConfig({ stickyHeader: v })} />
            <ToggleRow label="Alternate Row Colors" checked={cfg.alternateRowColors !== false} onCheckedChange={(v) => setConfig({ alternateRowColors: v })} />
            <ToggleRow label="Compact Mode" checked={!!cfg.compactMode} onCheckedChange={(v) => setConfig({ compactMode: v })} />
          </TabsContent>

          {/* BEHAVIOR */}
          <TabsContent value="behavior" className="mt-0 space-y-4">
            <ToggleRow label="Allow Add Rows" checked={cfg.allowAddRows !== false} onCheckedChange={(v) => setConfig({ allowAddRows: v })} />
            <ToggleRow label="Allow Delete Rows" checked={cfg.allowDeleteRows !== false} onCheckedChange={(v) => setConfig({ allowDeleteRows: v })} />
            <ToggleRow label="Allow Duplicate Rows" checked={cfg.allowDuplicateRows !== false} onCheckedChange={(v) => setConfig({ allowDuplicateRows: v })} />
            <ToggleRow label="Allow Reorder Rows" checked={cfg.allowReorderRows !== false} onCheckedChange={(v) => setConfig({ allowReorderRows: v })} />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Min Rows">
                <Input type="number" min={0} value={cfg.minRows ?? ''} onChange={(e) => setConfig({ minRows: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
              <Field label="Max Rows">
                <Input type="number" min={0} value={cfg.maxRows ?? ''} onChange={(e) => setConfig({ maxRows: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
              <Field label="Default Rows">
                <Input type="number" min={0} value={cfg.defaultRows ?? ''} onChange={(e) => setConfig({ defaultRows: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
            </div>
          </TabsContent>

          {/* COLUMNS */}
          <TabsContent value="columns" className="mt-0">
            <LineItemsColumnsEditor
              columns={element.lineItemColumns ?? []}
              onChange={(lineItemColumns) => onChange({ lineItemColumns })}
              excludeFormId={formId ?? undefined}
            />
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  )
}

// ---------------------------------------------------------------------------
// Rule group (mode radio + optional expression)
// ---------------------------------------------------------------------------

function RuleGroup({ title, mode, options, onModeChange, expression, onExpressionChange, showExpression, variables, exprLabel }: {
  title: string
  mode: string
  options: [string, string][]
  onModeChange: (m: string) => void
  expression: string
  onExpressionChange: (v: string) => void
  showExpression: boolean
  variables: VariableDecl[]
  exprLabel: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</Label>
      <div className="flex flex-col gap-1">
        {options.map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => onModeChange(val)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors',
              mode === val ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300',
            )}
          >
            <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded-full border', mode === val ? 'border-indigo-500' : 'border-slate-300')}>
              {mode === val && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
            </span>
            {lbl}
          </button>
        ))}
      </div>
      {showExpression && (
        <ExpressionField value={expression} onChange={onExpressionChange} variables={variables} label={exprLabel} />
      )}
    </div>
  )
}

// Presentational (non-data-bearing) types' General-tab bodies live in
// PresentationalForms.tsx, referenced via component-registry.ts's
// configPanel field (see the dispatch in ElementConfig above).
