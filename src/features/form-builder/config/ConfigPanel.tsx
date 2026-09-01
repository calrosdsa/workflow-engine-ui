import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal, Layers, FileText, LayoutPanelTop, LayoutGrid, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useFormBuilderStore, useFormMetaStore, insertAccountSection, removeAccountSection, updateDetailTabs, updateDetailLayout, updateTabOrientation, updateCustomActions, updateAfterSubmitWorkflow } from '../store'
import { DetailPageConfigSection } from './DetailPageConfigSection'
import { CustomActionsConfigSection } from './CustomActionsConfigSection'
import { UiWorkflowEditor } from '@/features/ui-workflows/UiWorkflowEditor'
import { emptyUiWorkflow } from '@/features/ui-workflows/types'
import { DetailPageBuilderOverlay } from '@/features/detail-page-builder/DetailPageBuilderOverlay'
import { resolveDetailTabs } from '@/features/forms/runtime/detail-tabs/registry'
import { COMPONENT_REGISTRY, supportsUnique, supportsRecordTitle, supportsSearchable } from '../component-registry'
import { projectToFields } from '../projection'
import { slugifyKey, isParentLinkElement } from '../factory'
import {
  type FormElement, type FormSchema, type VisibilityMode, type RequiredMode, type ReadOnlyMode,
  type ElementValidation, type ElementBehavior, type ElementAppearance, type BindingSource,
  type CreateUserSettings, type LineItemAggregateFn, emptyCreateUserSettings,
} from '../schema'
import { ExpressionField } from './ExpressionField'
import { OptionsEditor } from './OptionsEditor'
import { FormReferenceSelect } from './FormReferenceSelect'
import { DisplayFieldSelect } from './DisplayFieldSelect'
import { AdoptedReferenceFieldSelect } from './AdoptedReferenceFieldSelect'
import { LineItemsColumnsEditor } from './LineItemsColumnsEditor'
import { AdvancedSettingsSection } from './AdvancedSettingsSection'
import type { LineItemsConfig } from '../schema'
import type { VariableDecl } from '@/features/workflows/types'

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  )
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[12px] font-normal text-[hsl(var(--muted-foreground))]">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

// Local text-editing state, committed to the comma-separated array only on
// blur — element.validation.allowedMimeTypes is the source of truth, but
// deriving the input's `value` from array.join(', ') on every keystroke
// would reformat mid-typing (e.g. typing "image/jpeg, i" re-splits/re-joins
// before the second type is finished) and fight the user's cursor. Syncs
// from the external value when it changes for a reason other than this
// input's own edits (e.g. switching selected elements).
function AllowedMimeTypesField({ value, onCommit }: { value: string[] | undefined; onCommit: (types: string[]) => void }) {
  const [text, setText] = useState((value ?? []).join(', '))
  useEffect(() => setText((value ?? []).join(', ')), [value])

  return (
    <Field label="Allowed File Types" hint="Comma-separated MIME types, e.g. image/jpeg, image/png — leave blank to allow any type">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text.split(',').map((t) => t.trim()).filter(Boolean))}
        placeholder="image/jpeg, image/png"
        className="h-8 font-mono text-[11px]"
      />
    </Field>
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
    <aside className="flex w-80 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {element ? (
        <ElementConfig element={element} variables={variables} formId={formId} schema={schema} onChange={(p) => updateElement(element!.id, p)} />
      ) : section ? (
        <SectionConfig
          key={section.id}
          title={section.title}
          description={section.description ?? ''}
          onChange={(p) => updateSection(section.id, p)}
        />
      ) : (
        <FormConfig schema={schema} formId={formId} />
      )}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Form config (shown when nothing is selected — the builder's default state)
// ---------------------------------------------------------------------------

function FormConfig({ schema, formId }: { schema: FormSchema; formId: string | null }) {
  const formName = useFormMetaStore((s) => s.name)
  const cfg: CreateUserSettings = schema.settings?.createUser ?? emptyCreateUserSettings()
  const [detailPageOpen, setDetailPageOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [customActionsOpen, setCustomActionsOpen] = useState(false)
  const [afterSubmitOpen, setAfterSubmitOpen] = useState(false)
  const tabCount = resolveDetailTabs(schema.settings?.detailTabs).filter((t) => !t.hidden).length
  const actionCount = (schema.settings?.customActions ?? []).length
  const afterSubmitCount = (schema.settings?.afterSubmitWorkflow?.steps ?? []).length
  const fields = useMemo(() => projectToFields(schema).fields, [schema])

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--foreground))] px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--background))]/20 ring-1 ring-[hsl(var(--background))]/30">
          <SlidersHorizontal size={17} className="text-[hsl(var(--background))]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[hsl(var(--background))]">Form Settings</p>
          <p className="text-[10px] text-[hsl(var(--background))]/60">Additional configuration</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Additional Form Settings</p>
          <ToggleRow
            label={`Do you want to create a user with each ${formName} enrollment?`}
            checked={cfg.enabled}
            onCheckedChange={(enabled) => (enabled ? insertAccountSection() : removeAccountSection())}
          />
          {cfg.enabled && (
            <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Create User</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                An "Account" section was added to the canvas with Name, Email, and Role fields.
                Edit those fields directly on the canvas — they behave like any other field.
              </p>
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">View-only columns</p>
                {cfg.viewOnlyColumns.map((col) => (
                  <div key={col.id} className="flex items-center justify-between rounded-md bg-[hsl(var(--card))] px-2.5 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))] ring-1 ring-[hsl(var(--border))]">
                    {col.label}
                    <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Read only</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Detail Page</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Which tabs show on this form's record detail page, in what order, and who can see each one.
            </p>
            {formId ? (
              <div className="space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetailPageOpen(true)}
                  className="flex w-full items-center justify-between gap-2 text-[12px]"
                >
                  <span className="flex items-center gap-2">
                    <LayoutPanelTop size={14} className="text-[hsl(var(--muted-foreground))]" />
                    Configure Detail Page
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{tabCount} tab{tabCount === 1 ? '' : 's'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCanvasOpen(true)}
                  className="flex w-full items-center gap-2 text-[12px]"
                >
                  <LayoutGrid size={14} className="text-[hsl(var(--muted-foreground))]" />
                  Open Canvas Editor
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Save this form first to configure its Detail Page tabs.</p>
            )}
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Custom Actions</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Menu items in the record detail's "..." menu that update a field, gated by who can see them and when.
            </p>
            {formId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomActionsOpen(true)}
                className="flex w-full items-center justify-between gap-2 text-[12px]"
              >
                <span className="flex items-center gap-2">
                  <Zap size={14} className="text-[hsl(var(--muted-foreground))]" />
                  Configure Custom Actions
                </span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{actionCount} action{actionCount === 1 ? '' : 's'}</span>
              </Button>
            ) : (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Save this form first to configure its custom actions.</p>
            )}
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">After Submit</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Steps that run in the browser once a record is saved from this form. They run after the save and can’t stop it.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAfterSubmitOpen(true)}
              className="flex w-full items-center justify-between gap-2 text-[12px]"
            >
              <span className="flex items-center gap-2">
                <Zap size={14} className="text-[hsl(var(--muted-foreground))]" />
                Configure After Submit
              </span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{afterSubmitCount} step{afterSubmitCount === 1 ? '' : 's'}</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <Drawer open={afterSubmitOpen} onOpenChange={setAfterSubmitOpen}>
        <DrawerContent size="lg">
          <DrawerHeader>
            <DrawerTitle>After Submit</DrawerTitle>
            <DrawerDescription>
              Runs in the viewer’s browser once a record is saved from this form — show a message, branch on what
              was entered, write another record, or hand off to a server workflow. It runs <em>after</em> the save,
              so it can’t prevent one; put a genuine veto in the form’s Before trigger instead.
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="p-6">
              <UiWorkflowEditor
                value={schema.settings?.afterSubmitWorkflow ?? emptyUiWorkflow()}
                onChange={updateAfterSubmitWorkflow}
                fields={fields}
                help="The saved record is in context: conditions can branch on what was entered, and an update step addresses it with no extra configuration."
              />
            </div>
          </ScrollArea>
          <DrawerFooter className="items-center justify-between sm:justify-between">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {afterSubmitCount} step{afterSubmitCount === 1 ? '' : 's'} — changes apply instantly, use the builder's Save to persist them.
            </p>
            <Button type="button" onClick={() => setAfterSubmitOpen(false)}>Done</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {formId && (
        <Drawer open={detailPageOpen} onOpenChange={setDetailPageOpen}>
          <DrawerContent size="lg">
            <DrawerHeader>
              <DrawerTitle>Detail Page</DrawerTitle>
              <DrawerDescription>
                Which tabs show on this form's record detail page, in what order, and who can see each one.
              </DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="flex-1">
              <div className="p-6">
                <DetailPageConfigSection
                  formId={formId}
                  detailTabs={schema.settings?.detailTabs}
                  onChange={updateDetailTabs}
                />
              </div>
            </ScrollArea>
            <DrawerFooter className="items-center justify-between sm:justify-between">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {tabCount} tab{tabCount === 1 ? '' : 's'} visible — changes apply instantly, use the builder's Save to persist them.
              </p>
              <Button type="button" onClick={() => setDetailPageOpen(false)}>Done</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {formId && (
        <Drawer open={customActionsOpen} onOpenChange={setCustomActionsOpen}>
          <DrawerContent size="lg">
            <DrawerHeader>
              <DrawerTitle>Custom Actions</DrawerTitle>
              <DrawerDescription>
                Menu items in the record detail's "..." menu that update a field, gated by who can see them and when.
              </DrawerDescription>
            </DrawerHeader>
            <ScrollArea className="flex-1">
              <div className="p-6">
                <CustomActionsConfigSection
                  formId={formId}
                  schema={schema}
                  customActions={schema.settings?.customActions}
                  onChange={updateCustomActions}
                />
              </div>
            </ScrollArea>
            <DrawerFooter className="items-center justify-between sm:justify-between">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {actionCount} action{actionCount === 1 ? '' : 's'} — changes apply instantly, use the builder's Save to persist them.
              </p>
              <Button type="button" onClick={() => setCustomActionsOpen(false)}>Done</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {formId && (
        <DetailPageBuilderOverlay
          open={canvasOpen}
          onOpenChange={setCanvasOpen}
          formId={formId}
          fields={fields}
          schema={schema}
          onChangeTabs={updateDetailTabs}
          onChangeLayout={updateDetailLayout}
          onChangeOrientation={updateTabOrientation}
        />
      )}
    </>
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
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--foreground))] px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--background))]/20 ring-1 ring-[hsl(var(--background))]/30">
          <Layers size={17} className="text-[hsl(var(--background))]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[hsl(var(--background))]">Section</p>
          <p className="text-[10px] text-[hsl(var(--background))]/60">Layout container</p>
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

function ElementConfig({ element, variables, formId, schema, onChange }: {
  element: FormElement
  variables: VariableDecl[]
  formId: string | null
  schema: FormSchema
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
  const isFileUpload = ['file', 'image'].includes(element.component)
  const isFormRef = element.component === 'form'
  const parentFormId = useFormMetaStore((s) => s.parentFormId)
  const isParentLink = isFormRef && isParentLinkElement(element, parentFormId)
  const isLineItems = element.component === 'line_items'
  const isLineItemCount = element.component === 'line_item_count'
  const canBeUnique = supportsUnique(element.component)
  const canBeRecordTitle = supportsRecordTitle(element.component)
  const canBeSearchable = supportsSearchable(element.component)

  // This form's own fields, for the Advanced Settings condition builder's
  // field picker — excludes the element being configured (a rule can't
  // meaningfully condition on the field it's attached to).
  const formFields = schema.sections
    .flatMap((s) => s.columns)
    .flatMap((c) => c.elements)
    .filter((e) => e.id !== element.id)

  // Line Item Count's target picker: only grids that have already been saved
  // at least once (have a childFormId) — otherwise the count field would
  // point at nothing the backend can resolve.
  const lineItemsElements = schema.sections
    .flatMap((s) => s.columns)
    .flatMap((c) => c.elements)
    .filter((e) => e.component === 'line_items' && e.childFormId)

  // Line Item Count's column picker (sum/avg/min/max only): the target
  // grid's own row columns, restricted to 'number' components — the only
  // column component whose fieldType (component-registry.ts) is numeric
  // (backend's numericTypes only allows TypeInteger/TypeDecimal, and this
  // builder never produces an integer column outside its own system fields).
  const numericColumnsOfTargetGrid = (lineItemsElements.find((e) => e.childFormId === element.formRef)?.lineItemColumns ?? [])
    .flatMap((s) => s.columns)
    .flatMap((c) => c.elements)
    .filter((e) => e.component === 'number')

  const header = (
    <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] px-4 py-3.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary-foreground))]/20 ring-1 ring-[hsl(var(--primary-foreground))]/30">
        <Icon size={17} className="text-[hsl(var(--primary-foreground))]" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[hsl(var(--primary-foreground))]">{reg.label}</p>
        <p className="truncate font-mono text-[10px] text-[hsl(var(--primary-foreground))]/60">{element.key}</p>
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
        <div className="border-b border-[hsl(var(--border))] px-3 pb-2 pt-2.5">
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
                  {canBeRecordTitle && (
                    <div className="space-y-1">
                      <ToggleRow
                        label="Use in Record Title"
                        checked={!!element.isRecordTitle}
                        onCheckedChange={(v) => onChange({ isRecordTitle: v })}
                      />
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        Shown instead of the record ID on the Detail page and wherever another form links to this record. Combine with other title fields to build a composite title.
                      </p>
                    </div>
                  )}
                  {!hasOptions && !isFormRef && !isLineItemCount && element.component !== 'checkbox' && element.component !== 'switch' && (
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
                    <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Form Reference</p>
                      {isParentLink ? (
                        <Field label="Referenced Form" hint="This field links the form to its parent — use “Unlink Dependent Form” from the form list to change or remove this relationship.">
                          <div className="flex h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-[13px] text-[hsl(var(--muted-foreground))]">
                            <ParentFormName formId={element.formRef} />
                          </div>
                        </Field>
                      ) : (
                        <Field label="Referenced Form" hint="Stores the form's id; displays its name.">
                          <FormReferenceSelect
                            value={element.formRef}
                            excludeId={formId ?? undefined}
                            onChange={(formRef) => onChange({ formRef, displayField: undefined })}
                          />
                        </Field>
                      )}
                      <Field label="Display Field" hint="Which field of the referenced form to show in the dropdown and use for search.">
                        <DisplayFieldSelect
                          formId={element.formRef}
                          value={element.displayField}
                          onChange={(displayField) => onChange({ displayField })}
                        />
                      </Field>
                    </div>
                  )}
                  {isLineItemCount && (
                    <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Line Item Aggregate</p>
                      <Field label="Grid" hint="Which Line Items grid on this form to aggregate. Only grids that have been saved at least once are shown.">
                        <SelectMenu
                          value={element.formRef ?? ''}
                          onValueChange={(formRef) => onChange({ formRef, aggregateField: undefined })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={lineItemsElements.length ? 'Select a grid…' : 'Save the form first to add a grid'} />
                          </SelectTrigger>
                          <SelectContent>
                            {lineItemsElements.map((el) => (
                              <SelectItem key={el.id} value={el.childFormId!}>{el.label || el.key}</SelectItem>
                            ))}
                          </SelectContent>
                        </SelectMenu>
                      </Field>
                      <Field label="Function">
                        <SelectMenu
                          value={element.aggregateFn ?? 'count'}
                          onValueChange={(aggregateFn) => onChange({ aggregateFn: aggregateFn as LineItemAggregateFn, aggregateField: undefined })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="count">Count</SelectItem>
                            <SelectItem value="sum">Sum</SelectItem>
                            <SelectItem value="avg">Average</SelectItem>
                            <SelectItem value="min">Min</SelectItem>
                            <SelectItem value="max">Max</SelectItem>
                          </SelectContent>
                        </SelectMenu>
                      </Field>
                      {element.aggregateFn && element.aggregateFn !== 'count' && (
                        <Field label="Column" hint="Which numeric column on that grid to aggregate.">
                          <SelectMenu value={element.aggregateField ?? ''} onValueChange={(aggregateField) => onChange({ aggregateField })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={numericColumnsOfTargetGrid.length ? 'Select a column…' : 'Grid has no Number columns'} />
                            </SelectTrigger>
                            <SelectContent>
                              {numericColumnsOfTargetGrid.map((col) => (
                                <SelectItem key={col.id} value={col.key}>{col.label || col.key}</SelectItem>
                              ))}
                            </SelectContent>
                          </SelectMenu>
                        </Field>
                      )}
                    </div>
                  )}
                  {!isFormRef && !isLineItemCount && (
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
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No two records may share this value.</p>
                  </div>
                )}
                {canBeSearchable && (
                  <div className="space-y-1">
                    <ToggleRow
                      label="Include in Search"
                      checked={!!element.searchable}
                      onCheckedChange={(v) => onChange({ searchable: v })}
                    />
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Included when users search this form's records.</p>
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
                {isFileUpload && (
                  <>
                    <Field label="Max File Size (MB)" hint="Leave blank for no per-field limit">
                      <Input
                        type="number"
                        min={0}
                        value={element.validation.maxFileSizeBytes ? element.validation.maxFileSizeBytes / (1024 * 1024) : ''}
                        onChange={(e) => setValidation({
                          maxFileSizeBytes: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 1024 * 1024),
                        })}
                        className="h-8 text-sm"
                      />
                    </Field>
                    <AllowedMimeTypesField
                      value={element.validation.allowedMimeTypes}
                      onCommit={(types) => setValidation({ allowedMimeTypes: types.length ? types : undefined })}
                    />
                  </>
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

                <div className="h-px bg-[hsl(var(--border))]" />
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

                <div className="h-px bg-[hsl(var(--border))]" />
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

                <div className="h-px bg-[hsl(var(--border))]" />
                <AdvancedSettingsSection
                  settings={element.advancedSettings ?? []}
                  fields={formFields}
                  onChange={(advancedSettings) => onChange({ advancedSettings })}
                />
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

export function LineItemsConfigTabs({ element, formId, onChange }: {
  element: FormElement
  formId: string | null
  onChange: (patch: Partial<FormElement>) => void
}) {
  const cfg: LineItemsConfig = element.lineItemConfig ?? {}
  const setConfig = (patch: Partial<LineItemsConfig>) => onChange({ lineItemConfig: { ...cfg, ...patch } })

  // Switching sourceMode while a generated child form (childFormId) already
  // exists silently strands it: syncLineItemsChildren skips 'existing'-mode
  // elements entirely (generate→adopt orphans the old child form with no
  // cleanup path), and switching back to 'generated' later would UPDATE that
  // same stale childFormId rather than treating it as gone (FR-C1-004). Warn
  // before applying the switch rather than letting either happen silently —
  // there's no undo for a child form once it's synced to the backend.
  const [pendingSourceMode, setPendingSourceMode] = useState<'generated' | 'existing' | null>(null)
  const currentMode = element.sourceMode ?? 'generated'

  const applySourceMode = (sourceMode: 'generated' | 'existing') => {
    if (sourceMode === currentMode) return
    if (element.childFormId) {
      setPendingSourceMode(sourceMode)
      return
    }
    onChange({ sourceMode })
  }

  return (
    <>
    <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[hsl(var(--border))] px-3 pb-2 pt-2.5">
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

            <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Data Source</p>
              <Field label="Source" hint="Existing form: the grid becomes a filtered view into a normal, independently-visible form — it keeps its own workflows/permissions/standalone page. Generated: the original behavior — a hidden child form owned entirely by this grid.">
                <SelectMenu
                  value={currentMode}
                  onValueChange={(sourceMode) => applySourceMode(sourceMode as 'generated' | 'existing')}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generated">Generated (auto-create a child form)</SelectItem>
                    <SelectItem value="existing">Existing form</SelectItem>
                  </SelectContent>
                </SelectMenu>
              </Field>
              {element.sourceMode === 'existing' && (
                <>
                  <Field label="Form" hint="An existing form with a reference field pointing back at this form — that's what makes it eligible to adopt as a Line Items child.">
                    <FormReferenceSelect
                      value={element.adoptedFormRef}
                      excludeId={formId ?? undefined}
                      requireReferenceTo={formId ?? undefined}
                      onChange={(adoptedFormRef) => onChange({ adoptedFormRef, adoptedReferenceField: undefined })}
                    />
                  </Field>
                  <Field label="Reference Field" hint="Which field on that form points back at this one. The adopted form must already have this field — adoption never creates or changes fields on a form it doesn't own.">
                    <AdoptedReferenceFieldSelect
                      formId={element.adoptedFormRef}
                      parentFormId={formId ?? undefined}
                      value={element.adoptedReferenceField}
                      onChange={(adoptedReferenceField) => onChange({ adoptedReferenceField })}
                    />
                  </Field>
                </>
              )}
            </div>

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
            <Field label="Display Mode" hint="Cards works better on narrow screens or grids with many columns.">
              <SelectMenu value={cfg.displayMode ?? 'table'} onValueChange={(displayMode) => setConfig({ displayMode: displayMode as 'table' | 'cards' })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">Table</SelectItem>
                  <SelectItem value="cards">Cards</SelectItem>
                </SelectContent>
              </SelectMenu>
            </Field>
            {(cfg.displayMode ?? 'table') === 'table' && (
              <>
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
              </>
            )}
            <ToggleRow label="Compact Mode" checked={!!cfg.compactMode} onCheckedChange={(v) => setConfig({ compactMode: v })} />
          </TabsContent>

          {/* BEHAVIOR */}
          <TabsContent value="behavior" className="mt-0 space-y-4">
            <Field label="Row Editing" hint="Inline edits fields directly in the grid, with no separate row-open step. A column that is itself a nested Line Items grid always opens the sidebar regardless of this setting.">
              <SelectMenu value={cfg.rowEditMode ?? 'sidebar'} onValueChange={(rowEditMode) => setConfig({ rowEditMode: rowEditMode as 'sidebar' | 'inline' })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sidebar">Sidebar (open row to edit)</SelectItem>
                  <SelectItem value="inline">Inline (edit directly in grid)</SelectItem>
                </SelectContent>
              </SelectMenu>
            </Field>
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
            {element.sourceMode === 'existing' ? (
              <AdoptedColumnsPreview formId={element.adoptedFormRef} />
            ) : (
              <LineItemsColumnsEditor
                columns={element.lineItemColumns ?? []}
                onChange={(lineItemColumns) => onChange({ lineItemColumns })}
                excludeFormId={formId ?? undefined}
              />
            )}
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
    <ConfirmDialog
      open={pendingSourceMode !== null}
      onOpenChange={(open) => { if (!open) setPendingSourceMode(null) }}
      title={pendingSourceMode === 'existing' ? 'Switch to an existing form?' : 'Switch to a generated form?'}
      description={
        pendingSourceMode === 'existing'
          ? 'This grid currently owns an auto-generated child form. Switching to an existing form will NOT delete or migrate it — the generated form (and any rows already in it) will stay behind, no longer linked to this field. You can find and manage it directly from the Forms list.'
          : 'This grid was previously linked to a generated child form (from before it was switched to an existing form). Switching back to Generated will reuse and OVERWRITE that old form\'s columns rather than creating a fresh one — if it still holds rows from that earlier configuration, they\'ll remain, now under the new column layout.'
      }
      confirmLabel="Switch anyway"
      destructive
      onConfirm={() => {
        if (pendingSourceMode) onChange({ sourceMode: pendingSourceMode })
        setPendingSourceMode(null)
      }}
    />
    </>
  )
}

/** Read-only stand-in for LineItemsColumnsEditor when the grid targets an
 *  adopted form — columns aren't authored here in that mode, they ARE the
 *  adopted form's own real fields (edited on that form's own builder page).
 *  Shown instead of hiding the tab outright so it's clear the tab isn't
 *  broken/empty, just not the place to configure columns for this grid. */
function AdoptedColumnsPreview({ formId }: { formId?: string }) {
  const { data: targetForm, isLoading } = useFormDef(formId ?? '')

  if (!formId) {
    return <p className="p-3 text-[12px] text-[hsl(var(--muted-foreground))]">Select a form in the General tab first.</p>
  }
  if (isLoading) {
    return <p className="p-3 text-[12px] text-[hsl(var(--muted-foreground))]">Loading fields…</p>
  }
  return (
    <div className="space-y-1 p-1">
      <p className="mb-2 text-[11px] text-[hsl(var(--muted-foreground))]">
        Columns come from this form's own fields. Edit them on its own page in the Forms list.
      </p>
      {(targetForm?.fields ?? []).map((f) => (
        <div key={f.name} className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-2.5 py-1.5 text-[12px]">
          <span className="text-[hsl(var(--foreground))]">{f.label || f.name}</span>
          <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{f.type}</span>
        </div>
      ))}
    </div>
  )
}

/** Read-only name lookup for the locked "Referenced Form" display on a
 *  parent-link field (see isParentLinkElement) — the actual FormReferenceSelect
 *  combobox isn't rendered there at all, just this label, so there's no
 *  affordance to repoint the reference away from the parent. */
function ParentFormName({ formId }: { formId?: string }) {
  const { data: form, isLoading } = useFormDef(formId ?? '')
  return (
    <>
      <FileText size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
      <span className="truncate">{isLoading ? 'Loading…' : form?.name ?? formId}</span>
    </>
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
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{title}</Label>
      <div className="flex flex-col gap-1">
        {options.map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => onModeChange(val)}
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12px] transition-colors',
              mode === val ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))]',
            )}
          >
            <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded-full border', mode === val ? 'border-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]')}>
              {mode === val && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />}
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
