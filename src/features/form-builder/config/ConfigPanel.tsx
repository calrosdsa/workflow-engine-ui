import { useEffect, useId, useMemo, useState } from 'react'
import { SlidersHorizontal, Layers, FileText, LayoutPanelTop, LayoutGrid, Zap, ShieldCheck } from 'lucide-react'
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
import { useFormBuilderStore, useFormMetaStore, insertAccountSection, removeAccountSection, updateDetailTabs, updateDetailLayout, updateTabOrientation, updateCustomActions, updateAfterSubmitWorkflow, updateFieldChangeWorkflow, updateAccessScope } from '../store'
import { DetailPageConfigSection } from './DetailPageConfigSection'
import { CustomActionsConfigSection } from './CustomActionsConfigSection'
import { AccessScopeConfigSection } from './AccessScopeConfigSection'
import { UiWorkflowEditor } from '@/features/ui-workflows/UiWorkflowEditor'
import { emptyUiWorkflow } from '@/features/ui-workflows/types'
import { emptyFieldChangeWorkflow } from '@/features/ui-workflows/useFieldChangeWorkflow'
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
import { ReferenceFilterSection } from './ReferenceFilterSection'
import type { LineItemsConfig } from '../schema'
import type { VariableDecl } from '@/features/workflows/types'
import type { NumberFormat, NumberFormatStyle, NumberFormatCurrencyPosition, NumberFormatNegativeStyle } from '@/features/forms/types'
import { useTranslation } from '@/features/i18n/I18nProvider'

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
  const id = useId()
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-[12px] font-normal text-[hsl(var(--muted-foreground))]">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
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
  const t = useTranslation()
  const [text, setText] = useState((value ?? []).join(', '))
  useEffect(() => setText((value ?? []).join(', ')), [value])

  return (
    <Field label={t('form_config.allowed_file_types')} hint={t('form_config.allowed_file_types_hint')}>
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

// How a 'number' field's value reads on display surfaces (RecordsTable, the
// Detail Page, card/kanban layouts) — see FieldDef.number_format's doc
// comment. `undefined`/an all-default object both render as a plain grouped
// number with 2 decimals; this panel doesn't try to collapse the latter back
// to the former, since the two are equivalent to every reader of the value.
function NumberFormatSection({ value, onChange }: {
  value: NumberFormat | undefined
  onChange: (v: NumberFormat | undefined) => void
}) {
  const t = useTranslation()
  const fmt = value ?? {}
  const set = (patch: Partial<NumberFormat>) => onChange({ ...fmt, ...patch })
  const isCurrency = fmt.style === 'currency'
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.number_format')}</p>
      <Field label={t('form_config.style')} hint={t('form_config.number_format_hint')}>
        <SelectMenu value={fmt.style ?? 'number'} onValueChange={(style) => set({ style: style as NumberFormatStyle })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="number">{t('form_config.plain_number')}</SelectItem>
            <SelectItem value="currency">{t('form_config.currency')}</SelectItem>
            <SelectItem value="percent">{t('form_config.percent')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
      {isCurrency && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('form_config.symbol')} hint={t('form_config.symbol_hint')}>
            <Input
              value={fmt.currency_symbol ?? ''}
              onChange={(e) => set({ currency_symbol: e.target.value })}
              placeholder="$"
              className="h-8 text-sm"
            />
          </Field>
          <Field label={t('form_config.position')}>
            <SelectMenu
              value={fmt.currency_position ?? 'prefix'}
              onValueChange={(currency_position) => set({ currency_position: currency_position as NumberFormatCurrencyPosition })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prefix">{t('form_config.before_currency')}</SelectItem>
                <SelectItem value="suffix">{t('form_config.after_currency')}</SelectItem>
              </SelectContent>
            </SelectMenu>
          </Field>
        </div>
      )}
      <Field label={t('form_config.decimals')} hint={t('form_config.decimals_hint')}>
        <Input
          type="number"
          min={0}
          max={10}
          value={fmt.decimals ?? ''}
          onChange={(e) => set({ decimals: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="2"
          className="h-8 text-sm"
        />
      </Field>
      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] underline-offset-2 hover:underline"
      >
        {advancedOpen ? t('form_config.hide_advanced') : t('form_config.show_advanced')}
      </button>
      {advancedOpen && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('form_config.thousands_separator')} hint={t('form_config.thousands_separator_hint')}>
              <Input
                value={fmt.thousands_separator ?? ''}
                onChange={(e) => set({ thousands_separator: e.target.value })}
                placeholder=","
                maxLength={1}
                className="h-8 text-sm"
              />
            </Field>
            <Field label={t('form_config.decimal_separator')} hint={t('form_config.decimal_separator_hint')}>
              <Input
                value={fmt.decimal_separator ?? ''}
                onChange={(e) => set({ decimal_separator: e.target.value })}
                placeholder="."
                maxLength={1}
                className="h-8 text-sm"
              />
            </Field>
          </div>
          <Field label={t('form_config.negative_values')}>
            <SelectMenu
              value={fmt.negative_style ?? 'minus'}
              onValueChange={(negative_style) => set({ negative_style: negative_style as NumberFormatNegativeStyle })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minus">-1,234.56</SelectItem>
                <SelectItem value="parentheses">(1,234.56)</SelectItem>
              </SelectContent>
            </SelectMenu>
          </Field>
        </>
      )}
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
  const t = useTranslation()
  const formName = useFormMetaStore((s) => s.name)
  const cfg: CreateUserSettings = schema.settings?.createUser ?? emptyCreateUserSettings()
  const [detailPageOpen, setDetailPageOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [customActionsOpen, setCustomActionsOpen] = useState(false)
  const [afterSubmitOpen, setAfterSubmitOpen] = useState(false)
  const [whileFillingOpen, setWhileFillingOpen] = useState(false)
  const [accessScopeOpen, setAccessScopeOpen] = useState(false)
  const tabCount = resolveDetailTabs(schema.settings?.detailTabs).filter((t) => !t.hidden).length
  const actionCount = (schema.settings?.customActions ?? []).length
  const accessScopeRules = schema.settings?.accessScope ?? []
  const afterSubmitCount = (schema.settings?.afterSubmitWorkflow?.steps ?? []).length
  const fieldChange = schema.settings?.fieldChangeWorkflow ?? emptyFieldChangeWorkflow()
  const fields = useMemo(() => projectToFields(schema).fields, [schema])

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--foreground))] px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--background))]/20 ring-1 ring-[hsl(var(--background))]/30">
          <SlidersHorizontal size={17} className="text-[hsl(var(--background))]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[hsl(var(--background))]">{t('form_config.form_settings')}</p>
          <p className="text-[10px] text-[hsl(var(--background))]/60">{t('form_config.additional_configuration')}</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.additional_form_settings')}</p>
          <ToggleRow
            label={t('form_config.create_user_question', { name: formName })}
            checked={cfg.enabled}
            onCheckedChange={(enabled) => (enabled ? insertAccountSection() : removeAccountSection())}
          />
          {cfg.enabled && (
            <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.create_user')}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {t('form_config.create_user_help')}
              </p>
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('form_config.view_only_columns')}</p>
                {cfg.viewOnlyColumns.map((col) => (
                  <div key={col.id} className="flex items-center justify-between rounded-md bg-[hsl(var(--card))] px-2.5 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))] ring-1 ring-[hsl(var(--border))]">
                    {col.label}
                    <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('form_config.read_only')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.detail_page')}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.detail_page_help')}</p>
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
                    {t('form_config.configure_detail_page')}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{t(tabCount === 1 ? 'form_config.tab_one' : 'form_config.tab_many', { count: tabCount })}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCanvasOpen(true)}
                  className="flex w-full items-center gap-2 text-[12px]"
                >
                  <LayoutGrid size={14} className="text-[hsl(var(--muted-foreground))]" />
                  {t('form_config.open_canvas_editor')}
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('form_config.save_first_detail')}</p>
            )}
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.custom_actions')}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.custom_actions_help')}</p>
            {formId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomActionsOpen(true)}
                className="flex w-full items-center justify-between gap-2 text-[12px]"
              >
                <span className="flex items-center gap-2">
                  <Zap size={14} className="text-[hsl(var(--muted-foreground))]" />
                  {t('form_config.configure_custom_actions')}
                </span>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{t(actionCount === 1 ? 'form_config.action_one' : 'form_config.action_many', { count: actionCount })}</span>
              </Button>
            ) : (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('form_config.save_first_actions')}</p>
            )}
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.access_scope')}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.access_scope_help')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccessScopeOpen(true)}
              className="flex w-full items-center justify-between gap-2 text-[12px]"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[hsl(var(--muted-foreground))]" />
                {t('form_config.configure_access_scope')}
              </span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {accessScopeRules.length === 0 ? t('form_config.unrestricted') : t(accessScopeRules.length === 1 ? 'form_config.rule_one' : 'form_config.rule_many', { count: accessScopeRules.length })}
              </span>
            </Button>
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.while_filling_in')}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.while_filling_help')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWhileFillingOpen(true)}
              className="flex w-full items-center justify-between gap-2 text-[12px]"
            >
              <span className="flex items-center gap-2">
                <Zap size={14} className="text-[hsl(var(--muted-foreground))]" />
                {t('form_config.configure_while_filling')}
              </span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {t(fieldChange.workflow.steps.length === 1 ? 'form_config.step_one' : 'form_config.step_many', { count: fieldChange.workflow.steps.length })}
              </span>
            </Button>
          </div>

          <div className="h-px bg-[hsl(var(--border))]" />
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.after_submit')}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.after_submit_help')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAfterSubmitOpen(true)}
              className="flex w-full items-center justify-between gap-2 text-[12px]"
            >
              <span className="flex items-center gap-2">
                <Zap size={14} className="text-[hsl(var(--muted-foreground))]" />
                {t('form_config.configure_after_submit')}
              </span>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{t(afterSubmitCount === 1 ? 'form_config.step_one' : 'form_config.step_many', { count: afterSubmitCount })}</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <Drawer open={whileFillingOpen} onOpenChange={setWhileFillingOpen}>
        <DrawerContent size="lg">
          <DrawerHeader>
            <DrawerTitle>{t('form_config.while_filling_in')}</DrawerTitle>
            <DrawerDescription>{t('form_config.while_filling_drawer_help')}</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-6">
              <Field
                label={t('form_config.watch_fields')}
                hint={t('form_config.watch_fields_hint')}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  {fields.map((f) => (
                    <label key={f.name} className="flex items-center gap-1.5 text-[12px]">
                      <Switch
                        checked={fieldChange.watch.includes(f.name)}
                        onCheckedChange={(on) =>
                          updateFieldChangeWorkflow({
                            ...fieldChange,
                            watch: on
                              ? [...fieldChange.watch, f.name]
                              : fieldChange.watch.filter((w) => w !== f.name),
                          })
                        }
                      />
                      <span className="truncate">{f.label || f.name}</span>
                    </label>
                  ))}
                </div>
              </Field>

              <UiWorkflowEditor
                value={fieldChange.workflow}
                onChange={(workflow) => updateFieldChangeWorkflow({ ...fieldChange, workflow })}
                fields={fields}
                help={t('form_config.field_change_help')}
              />
            </div>
          </ScrollArea>
          <DrawerFooter className="items-center justify-between sm:justify-between">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {fieldChange.watch.length === 0 && fieldChange.workflow.steps.length > 0
                ? t('form_config.no_fields_watched')
                : t('form_config.watched_summary', { steps: fieldChange.workflow.steps.length, fields: fieldChange.watch.length })}
            </p>
            <Button type="button" onClick={() => setWhileFillingOpen(false)}>{t('common.done')}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={accessScopeOpen} onOpenChange={setAccessScopeOpen}>
        <DrawerContent size="lg">
          <DrawerHeader>
            <DrawerTitle>{t('form_config.access_scope')}</DrawerTitle>
            <DrawerDescription>{t('form_config.access_scope_drawer_help')}</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="p-6">
              <AccessScopeConfigSection
                rules={accessScopeRules}
                onChange={updateAccessScope}
                fields={fields}
              />
            </div>
          </ScrollArea>
          <DrawerFooter className="items-center justify-between sm:justify-between">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {t('form_config.access_scope_footer', { summary: accessScopeRules.length === 0 ? t('form_config.unrestricted') : t(accessScopeRules.length === 1 ? 'form_config.rule_one' : 'form_config.rule_many', { count: accessScopeRules.length }) })}
            </p>
            <Button type="button" onClick={() => setAccessScopeOpen(false)}>{t('common.done')}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={afterSubmitOpen} onOpenChange={setAfterSubmitOpen}>
        <DrawerContent size="lg">
          <DrawerHeader>
            <DrawerTitle>{t('form_config.after_submit')}</DrawerTitle>
            <DrawerDescription>{t('form_config.after_submit_drawer_help')}</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="p-6">
              <UiWorkflowEditor
                value={schema.settings?.afterSubmitWorkflow ?? emptyUiWorkflow()}
                onChange={updateAfterSubmitWorkflow}
                fields={fields}
                help={t('form_config.after_submit_workflow_help')}
              />
            </div>
          </ScrollArea>
          <DrawerFooter className="items-center justify-between sm:justify-between">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {t('form_config.workflow_footer', { count: afterSubmitCount })}
            </p>
            <Button type="button" onClick={() => setAfterSubmitOpen(false)}>{t('common.done')}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {formId && (
        <Drawer open={detailPageOpen} onOpenChange={setDetailPageOpen}>
          <DrawerContent size="lg">
            <DrawerHeader>
              <DrawerTitle>{t('form_config.detail_page')}</DrawerTitle>
              <DrawerDescription>{t('form_config.detail_page_help')}</DrawerDescription>
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
                {t('form_config.detail_footer', { count: tabCount })}
              </p>
              <Button type="button" onClick={() => setDetailPageOpen(false)}>{t('common.done')}</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {formId && (
        <Drawer open={customActionsOpen} onOpenChange={setCustomActionsOpen}>
          <DrawerContent size="lg">
            <DrawerHeader>
              <DrawerTitle>{t('form_config.custom_actions')}</DrawerTitle>
              <DrawerDescription>{t('form_config.custom_actions_help')}</DrawerDescription>
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
                {t('form_config.custom_actions_footer', { count: actionCount })}
              </p>
              <Button type="button" onClick={() => setCustomActionsOpen(false)}>{t('common.done')}</Button>
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
  const t = useTranslation()
  return (
    <>
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--foreground))] px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--background))]/20 ring-1 ring-[hsl(var(--background))]/30">
          <Layers size={17} className="text-[hsl(var(--background))]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[hsl(var(--background))]">{t('form_config.section')}</p>
          <p className="text-[10px] text-[hsl(var(--background))]/60">{t('form_config.layout_container')}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <Field label={t('form_config.section_title')}>
          <Input value={title} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-sm" />
        </Field>
        <Field label={t('form_config.description')} hint={t('form_config.section_description_hint')}>
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
  const t = useTranslation()
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
            <TabsTrigger value="general" className="flex-1 text-[11px]">{t('form_config.general')}</TabsTrigger>
            {!isPresentational && <TabsTrigger value="validation" className="flex-1 text-[11px]">{t('form_config.rules')}</TabsTrigger>}
            {!isPresentational && <TabsTrigger value="behavior" className="flex-1 text-[11px]">{t('form_config.logic')}</TabsTrigger>}
            <TabsTrigger value="appearance" className="flex-1 text-[11px]">{t('form_config.appearance')}</TabsTrigger>
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
                  <Field label={t('form_config.label')}>
                    <Input value={element.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
                  </Field>
                  <Field label={t('form_config.field_name_key')} hint={t('form_config.field_name_hint')}>
                    <Input
                      value={element.key}
                      onChange={(e) => onChange({ key: slugifyKey(e.target.value) })}
                      className="h-8 font-mono text-[12px]"
                    />
                  </Field>
                  <Field label={t('form_config.description')}>
                    <Input value={element.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} placeholder={t('form_config.shown_under_label')} className="h-8 text-sm" />
                  </Field>
                  {canBeRecordTitle && (
                    <div className="space-y-1">
                      <ToggleRow
                        label={t('form_config.use_record_title')}
                        checked={!!element.isRecordTitle}
                        onCheckedChange={(v) => onChange({ isRecordTitle: v })}
                      />
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {t('form_config.record_title_help')}
                      </p>
                    </div>
                  )}
                  {!hasOptions && !isFormRef && !isLineItemCount && element.component !== 'checkbox' && element.component !== 'switch' && (
                    <Field label={t('form_config.placeholder')}>
                      <Input value={element.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })} className="h-8 text-sm" />
                    </Field>
                  )}
                  <Field label={t('form_config.help_text')} hint={t('form_config.help_text_hint')}>
                    <Input value={element.helpText ?? ''} onChange={(e) => onChange({ helpText: e.target.value })} className="h-8 text-sm" />
                  </Field>
                  {hasOptions && (
                    <Field label={t('form_config.options')}>
                      <OptionsEditor options={element.options ?? []} onChange={(options) => onChange({ options })} />
                    </Field>
                  )}
                  {isFormRef && (
                    <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.form_reference')}</p>
                      {isParentLink ? (
                        <Field label={t('form_config.referenced_form')} hint={t('form_config.parent_form_hint')}>
                          <div className="flex h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 text-[13px] text-[hsl(var(--muted-foreground))]">
                            <ParentFormName formId={element.formRef} />
                          </div>
                        </Field>
                      ) : (
                        <Field label={t('form_config.referenced_form')} hint={t('form_config.referenced_form_hint')}>
                          <FormReferenceSelect
                            value={element.formRef}
                            excludeId={formId ?? undefined}
                            onChange={(formRef) => onChange({ formRef, displayField: undefined })}
                          />
                        </Field>
                      )}
                      <Field label={t('form_config.display_field')} hint={t('form_config.display_field_hint')}>
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
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.line_item_aggregate')}</p>
                      <Field label={t('form_config.grid')} hint={t('form_config.grid_hint')}>
                        <SelectMenu
                          value={element.formRef ?? ''}
                          onValueChange={(formRef) => onChange({ formRef, aggregateField: undefined })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder={lineItemsElements.length ? t('form_config.select_grid') : t('form_config.save_form_first_grid')} />
                          </SelectTrigger>
                          <SelectContent>
                            {lineItemsElements.map((el) => (
                              <SelectItem key={el.id} value={el.childFormId!}>{el.label || el.key}</SelectItem>
                            ))}
                          </SelectContent>
                        </SelectMenu>
                      </Field>
                      <Field label={t('form_config.function')}>
                        <SelectMenu
                          value={element.aggregateFn ?? 'count'}
                          onValueChange={(aggregateFn) => onChange({ aggregateFn: aggregateFn as LineItemAggregateFn, aggregateField: undefined })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="count">{t('form_config.count')}</SelectItem>
                            <SelectItem value="sum">{t('form_config.sum')}</SelectItem>
                            <SelectItem value="avg">{t('form_config.average')}</SelectItem>
                            <SelectItem value="min">{t('form_config.min')}</SelectItem>
                            <SelectItem value="max">{t('form_config.max')}</SelectItem>
                          </SelectContent>
                        </SelectMenu>
                      </Field>
                      {element.aggregateFn && element.aggregateFn !== 'count' && (
                        <Field label={t('form_config.column')} hint={t('form_config.column_hint')}>
                          <SelectMenu value={element.aggregateField ?? ''} onValueChange={(aggregateField) => onChange({ aggregateField })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={numericColumnsOfTargetGrid.length ? t('form_config.select_column') : t('form_config.no_number_columns')} />
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
                    <Field label={t('form_config.default_value')}>
                      <Input
                        value={element.defaultValue == null ? '' : String(element.defaultValue)}
                        onChange={(e) => onChange({ defaultValue: e.target.value })}
                        placeholder={t('form_config.static_default')}
                        className="h-8 text-sm"
                      />
                    </Field>
                  )}
                  {isNumeric && (
                    <NumberFormatSection
                      value={element.numberFormat}
                      onChange={(numberFormat) => onChange({ numberFormat })}
                    />
                  )}
                </>
              )}
            </TabsContent>

            {/* VALIDATION */}
            {!isPresentational && (
              <TabsContent value="validation" className="mt-0 space-y-4">
                <ToggleRow
                  label={t('form_config.required')}
                  checked={element.behavior.required === 'always'}
                  onCheckedChange={(v) => setBehavior({ required: v ? 'always' : 'optional' })}
                />
                {canBeUnique && (
                  <div className="space-y-1">
                    <ToggleRow
                      label={t('form_config.unique')}
                      checked={!!element.unique}
                      onCheckedChange={(v) => onChange({ unique: v })}
                    />
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.no_duplicates')}</p>
                  </div>
                )}
                {canBeSearchable && (
                  <div className="space-y-1">
                    <ToggleRow
                      label={t('form_config.include_in_search')}
                      checked={!!element.searchable}
                      onCheckedChange={(v) => onChange({ searchable: v })}
                    />
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.included_in_search')}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <ToggleRow
                    label={t('form_config.index')}
                    checked={!!element.index}
                    onCheckedChange={(v) => onChange({ index: v })}
                  />
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('form_config.index_help')}</p>
                </div>
                {isTextual && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t('form_config.min_length')}>
                      <Input type="number" value={element.validation.minLength ?? ''} onChange={(e) => setValidation({ minLength: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                    <Field label={t('form_config.max_length')}>
                      <Input type="number" value={element.validation.maxLength ?? ''} onChange={(e) => setValidation({ maxLength: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                  </div>
                )}
                {isNumeric && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t('form_config.min_value')}>
                      <Input type="number" value={element.validation.min ?? ''} onChange={(e) => setValidation({ min: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                    <Field label={t('form_config.max_value')}>
                      <Input type="number" value={element.validation.max ?? ''} onChange={(e) => setValidation({ max: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
                    </Field>
                  </div>
                )}
                {isTextual && (
                  <Field label={t('form_config.regex_pattern')} hint="e.g. ^[A-Z]{2}\d{4}$">
                    <Input value={element.validation.pattern ?? ''} onChange={(e) => setValidation({ pattern: e.target.value })} className="h-8 font-mono text-[11px]" />
                  </Field>
                )}
                {isFileUpload && (
                  <>
                    <Field label={t('form_config.max_file_size')} hint={t('form_config.no_file_limit')}>
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
                <Field label={t('form_config.custom_validation_message')}>
                  <Input value={element.validation.customMessage ?? ''} onChange={(e) => setValidation({ customMessage: e.target.value })} placeholder={t('form_config.shown_when_invalid')} className="h-8 text-sm" />
                </Field>
              </TabsContent>
            )}

            {/* BEHAVIOR */}
            {!isPresentational && (
              <TabsContent value="behavior" className="mt-0 space-y-5">
                {/* Visibility */}
                <RuleGroup
                  title={t('form_config.visibility')}
                  mode={element.behavior.visibility}
                  options={[['always', t('form_config.always_visible')], ['hidden', t('form_config.hidden')], ['expression', t('form_config.visible_when')]]}
                  onModeChange={(m) => setBehavior({ visibility: m as VisibilityMode })}
                  expression={element.behavior.visibleWhen ?? ''}
                  onExpressionChange={(v) => setBehavior({ visibleWhen: v })}
                  showExpression={element.behavior.visibility === 'expression'}
                  variables={variables}
                  exprLabel={t('form_config.visible_when')}
                />
                {/* Required */}
                <RuleGroup
                  title={t('form_config.mandatory')}
                  mode={element.behavior.required}
                  options={[['always', t('form_config.always_required')], ['optional', t('form_config.optional')], ['expression', t('form_config.required_when')]]}
                  onModeChange={(m) => setBehavior({ required: m as RequiredMode })}
                  expression={element.behavior.requiredWhen ?? ''}
                  onExpressionChange={(v) => setBehavior({ requiredWhen: v })}
                  showExpression={element.behavior.required === 'expression'}
                  variables={variables}
                  exprLabel={t('form_config.required_when')}
                />
                {/* Read Only */}
                <RuleGroup
                  title={t('form_config.read_only')}
                  mode={element.behavior.readOnly}
                  options={[['editable', t('form_config.editable')], ['always', t('form_config.always_read_only')], ['expression', t('form_config.read_only_when')]]}
                  onModeChange={(m) => setBehavior({ readOnly: m as ReadOnlyMode })}
                  expression={element.behavior.readOnlyWhen ?? ''}
                  onExpressionChange={(v) => setBehavior({ readOnlyWhen: v })}
                  showExpression={element.behavior.readOnly === 'expression'}
                  variables={variables}
                  exprLabel={t('form_config.read_only_when')}
                />

                <div className="h-px bg-[hsl(var(--border))]" />
                <ToggleRow label={t('form_config.disabled')} checked={!!element.behavior.disabled} onCheckedChange={(v) => setBehavior({ disabled: v })} />
                <Field label={t('form_config.dynamic_default')} hint={t('form_config.dynamic_default_hint')}>
                  <ExpressionField
                    value={element.behavior.dynamicDefault ?? ''}
                    onChange={(v) => setBehavior({ dynamicDefault: v })}
                    variables={variables}
                    placeholder='e.g. now()'
                    label={t('form_config.dynamic_default')}
                  />
                </Field>

                <div className="h-px bg-[hsl(var(--border))]" />
                {/* Data binding */}
                  <Field label={t('form_config.data_binding')} hint={t('form_config.data_binding_hint')}>
                  <SelectMenu value={element.binding.source} onValueChange={(v) => setBinding({ source: v as BindingSource })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">{t('form_config.none_user_input')}</SelectItem>
                      <SelectItem value="form_field" className="text-xs">{t('form_config.form_field')}</SelectItem>
                      <SelectItem value="workflow_variable" className="text-xs">{t('form_config.workflow_variable')}</SelectItem>
                      <SelectItem value="expression" className="text-xs">{t('form_config.computed_expression')}</SelectItem>
                      <SelectItem value="option_source" className="text-xs">{t('form_config.dynamic_option_source')}</SelectItem>
                    </SelectContent>
                  </SelectMenu>
                </Field>
                {(element.binding.source === 'form_field' || element.binding.source === 'workflow_variable') && (
                  <Field label={t('form_config.reference')}>
                    <Input value={element.binding.ref ?? ''} onChange={(e) => setBinding({ ref: e.target.value })} placeholder="name" className="h-8 font-mono text-[12px]" />
                  </Field>
                )}
                {element.binding.source === 'expression' && (
                  <Field label={t('form_config.computed_value')}>
                    <ExpressionField value={element.binding.expression ?? ''} onChange={(v) => setBinding({ expression: v })} variables={variables} label={t('form_config.computed_value')} />
                  </Field>
                )}
                {element.binding.source === 'option_source' && (
                  <Field label={t('form_config.option_source')} hint={t('form_config.option_source_hint')}>
                    <Input value={element.binding.optionSource ?? ''} onChange={(e) => setBinding({ optionSource: e.target.value })} placeholder="e.g. countries" className="h-8 text-sm" />
                  </Field>
                )}

                {isFormRef && (
                  <>
                    <div className="h-px bg-[hsl(var(--border))]" />
                    <ReferenceFilterSection element={element} schema={schema} onChange={onChange} />
                  </>
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
              <Field label={t('form_config.width')}>
                <SelectMenu value={element.appearance.width ?? 'full'} onValueChange={(v) => setAppearance({ width: v as ElementAppearance['width'] })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full" className="text-xs">{t('form_config.full_width')}</SelectItem>
                    <SelectItem value="half" className="text-xs">{t('form_config.half_width')}</SelectItem>
                    <SelectItem value="third" className="text-xs">{t('form_config.third_width')}</SelectItem>
                    <SelectItem value="quarter" className="text-xs">{t('form_config.quarter_width')}</SelectItem>
                    <SelectItem value="auto" className="text-xs">{t('form_config.auto')}</SelectItem>
                  </SelectContent>
                </SelectMenu>
              </Field>
              <Field label={t('form_config.responsive_span')} hint={t('form_config.responsive_span_hint')}>
                <Input type="number" min={1} max={12} value={element.appearance.colSpan ?? ''} onChange={(e) => setAppearance({ colSpan: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
              {!isPresentational && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('form_config.prefix')}><Input value={element.appearance.prefix ?? ''} onChange={(e) => setAppearance({ prefix: e.target.value })} placeholder="$" className="h-8 text-sm" /></Field>
                  <Field label={t('form_config.suffix')}><Input value={element.appearance.suffix ?? ''} onChange={(e) => setAppearance({ suffix: e.target.value })} placeholder=".00" className="h-8 text-sm" /></Field>
                </div>
              )}
              <Field label={t('form_config.tooltip')}>
                <Input value={element.appearance.tooltip ?? ''} onChange={(e) => setAppearance({ tooltip: e.target.value })} className="h-8 text-sm" />
              </Field>
              <Field label={t('form_config.css_class')} hint={t('form_config.css_class_hint')}>
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
  const t = useTranslation()
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
          <TabsTrigger value="general" className="flex-1 text-[11px]">{t('form_config.general')}</TabsTrigger>
          <TabsTrigger value="layout" className="flex-1 text-[11px]">{t('form_config.layout')}</TabsTrigger>
          <TabsTrigger value="behavior" className="flex-1 text-[11px]">{t('form_config.behavior')}</TabsTrigger>
          <TabsTrigger value="columns" className="flex-1 text-[11px]">{t('form_config.columns')}</TabsTrigger>
        </TabsList>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* GENERAL */}
          <TabsContent value="general" className="mt-0 space-y-4">
            <Field label={t('form_config.label')}>
              <Input value={element.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
            </Field>
            <Field label={t('form_config.internal_name_key')} hint={t('form_config.nested_records_hint')}>
              <Input value={element.key} onChange={(e) => onChange({ key: slugifyKey(e.target.value) })} className="h-8 font-mono text-[12px]" />
            </Field>
            <Field label={t('form_config.description')}>
              <Input value={element.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} placeholder={t('form_config.shown_under_label')} className="h-8 text-sm" />
            </Field>

            <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.data_source')}</p>
              <Field label={t('form_config.source')} hint={t('form_config.data_source_hint')}>
                <SelectMenu
                  value={currentMode}
                  onValueChange={(sourceMode) => applySourceMode(sourceMode as 'generated' | 'existing')}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* "Generated" only stays offered for an element that's
                        ALREADY in that mode (or a legacy element with a
                        childFormId from before this changed) — a brand-new
                        grid starts in 'existing' mode (factory.ts) and never
                        sees this option at all. Only ever adopting an
                        EXISTING form going forward. */}
                    {currentMode === 'generated' && (
                      <SelectItem value="generated">{t('form_config.generated_form')}</SelectItem>
                    )}
                    <SelectItem value="existing">{t('form_config.existing_form')}</SelectItem>
                  </SelectContent>
                </SelectMenu>
              </Field>
              {element.sourceMode === 'existing' && (
                <>
                  <Field label={t('form_config.form')} hint={t('form_config.adopted_form_hint')}>
                    <FormReferenceSelect
                      value={element.adoptedFormRef}
                      excludeId={formId ?? undefined}
                      requireReferenceTo={formId ?? undefined}
                      requireDependentOf={formId ?? undefined}
                      onChange={(adoptedFormRef) => onChange({ adoptedFormRef, adoptedReferenceField: undefined })}
                    />
                  </Field>
                  <Field label={t('form_config.reference_field')} hint={t('form_config.reference_field_hint')}>
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
              label={t('form_config.required')}
              checked={element.behavior.required === 'always'}
              onCheckedChange={(v) => onChange({ behavior: { ...element.behavior, required: v ? 'always' : 'optional' } })}
            />
            <ToggleRow
              label={t('form_config.read_only')}
              checked={element.behavior.readOnly === 'always'}
              onCheckedChange={(v) => onChange({ behavior: { ...element.behavior, readOnly: v ? 'always' : 'editable' } })}
            />
            <ToggleRow
              label={t('form_config.hidden')}
              checked={element.behavior.visibility === 'hidden'}
              onCheckedChange={(v) => onChange({ behavior: { ...element.behavior, visibility: v ? 'hidden' : 'always' } })}
            />
          </TabsContent>

          {/* LAYOUT */}
          <TabsContent value="layout" className="mt-0 space-y-4">
            <Field label={t('form_config.display_mode')} hint={t('form_config.display_mode_hint')}>
              <SelectMenu value={cfg.displayMode ?? 'table'} onValueChange={(displayMode) => setConfig({ displayMode: displayMode as 'table' | 'cards' })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">{t('form_config.table')}</SelectItem>
                  <SelectItem value="cards">{t('form_config.cards')}</SelectItem>
                </SelectContent>
              </SelectMenu>
            </Field>
            {(cfg.displayMode ?? 'table') === 'table' && (
              <>
                <Field label={t('form_config.table_height')} hint={t('form_config.grow_with_content')}>
                  <Input
                    type="number"
                    value={cfg.tableHeight ?? ''}
                    onChange={(e) => setConfig({ tableHeight: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </Field>
                <ToggleRow label={t('form_config.allow_resize')} checked={cfg.allowResize !== false} onCheckedChange={(v) => setConfig({ allowResize: v })} />
                <ToggleRow label={t('form_config.sticky_header')} checked={cfg.stickyHeader !== false} onCheckedChange={(v) => setConfig({ stickyHeader: v })} />
                <ToggleRow label={t('form_config.alternate_row_colors')} checked={cfg.alternateRowColors !== false} onCheckedChange={(v) => setConfig({ alternateRowColors: v })} />
              </>
            )}
            <ToggleRow label={t('form_config.compact_mode')} checked={!!cfg.compactMode} onCheckedChange={(v) => setConfig({ compactMode: v })} />
          </TabsContent>

          {/* BEHAVIOR */}
          <TabsContent value="behavior" className="mt-0 space-y-4">
            <Field label={t('form_config.row_editing')} hint={t('form_config.row_editing_hint')}>
              <SelectMenu value={cfg.rowEditMode ?? 'sidebar'} onValueChange={(rowEditMode) => setConfig({ rowEditMode: rowEditMode as 'sidebar' | 'inline' })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sidebar">{t('form_config.sidebar_edit')}</SelectItem>
                  <SelectItem value="inline">{t('form_config.inline_edit')}</SelectItem>
                </SelectContent>
              </SelectMenu>
            </Field>
            <ToggleRow label={t('form_config.allow_add_rows')} checked={cfg.allowAddRows !== false} onCheckedChange={(v) => setConfig({ allowAddRows: v })} />
            <ToggleRow label={t('form_config.allow_delete_rows')} checked={cfg.allowDeleteRows !== false} onCheckedChange={(v) => setConfig({ allowDeleteRows: v })} />
            <ToggleRow label={t('form_config.allow_duplicate_rows')} checked={cfg.allowDuplicateRows !== false} onCheckedChange={(v) => setConfig({ allowDuplicateRows: v })} />
            {/* Adopted/existing-form grids have no persisted row order (they
                sort by created_at) — showing this toggle would imply an
                effect it doesn't have. Only generated grids (their own
                _row_order system column) actually honor it. */}
            {element.sourceMode !== 'existing' && (
              <ToggleRow label={t('form_config.allow_reorder_rows')} checked={cfg.allowReorderRows !== false} onCheckedChange={(v) => setConfig({ allowReorderRows: v })} />
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('form_config.min_rows')}>
                <Input type="number" min={0} value={cfg.minRows ?? ''} onChange={(e) => setConfig({ minRows: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
              <Field label={t('form_config.max_rows')}>
                <Input type="number" min={0} value={cfg.maxRows ?? ''} onChange={(e) => setConfig({ maxRows: e.target.value === '' ? undefined : Number(e.target.value) })} className="h-8 text-sm" />
              </Field>
              <Field label={t('form_config.default_rows')}>
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
      title={pendingSourceMode === 'existing' ? t('form_config.switch_existing_title') : t('form_config.switch_generated_title')}
      description={
        pendingSourceMode === 'existing'
          ? t('form_config.switch_existing_description')
          : t('form_config.switch_generated_description')
      }
      confirmLabel={t('form_config.switch_anyway')}
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
  const t = useTranslation()
  const { data: targetForm, isLoading } = useFormDef(formId ?? '')

  if (!formId) {
    return <p className="p-3 text-[12px] text-[hsl(var(--muted-foreground))]">{t('form_config.select_form_first')}</p>
  }
  if (isLoading) {
    return <p className="p-3 text-[12px] text-[hsl(var(--muted-foreground))]">{t('form_config.loading_fields')}</p>
  }
  return (
    <div className="space-y-1 p-1">
      <p className="mb-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('form_config.adopted_columns_help')}</p>
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
  const t = useTranslation()
  const { data: form, isLoading } = useFormDef(formId ?? '')
  return (
    <>
      <FileText size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
      <span className="truncate">{isLoading ? t('form_config.loading') : form?.name ?? formId}</span>
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
