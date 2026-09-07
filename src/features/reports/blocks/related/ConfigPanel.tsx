import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForms, useForm } from '@/features/forms/hooks'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { generatedLineItemsChildren } from '@/features/form-builder/lineItemsSync'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import type { NumberFormat } from '../../types'
import { ColumnNumberFormat } from '../ColumnNumberFormat'
import type { ColumnConfig } from '../table/schema'
import type { RelatedBlockConfig } from './schema'

// Config surface for the "related" block type (FR-J1-002 section 1): a parent-form
// picker, then a child-form picker restricted to forms that are GENERATED
// Line Items children of the selected parent -- the same "restrict the
// picker to only legal choices" precedent trigger_workflow's own
// ConfigPanel already establishes (FR-D2-017), rather than letting an
// author pick an unrelated form that would fail server-side validation at
// generation time.
//
// useForms() (GET /forms, ListForms in api/forms/handler.go) deliberately
// excludes every is_line_items row -- Line Items children are generated/
// managed implicitly by their parent's builder config and are never a
// standalone list entry. So the eligible-children list can't be built by
// filtering `forms`; instead it's read off the PARENT form's own layout
// (fetched separately via useForm + resolveFormSchema), which already
// carries each generated grid's childFormId -- lineItemsSync.ts's
// syncOneGrid sets it there at save time, and generatedLineItemsChildren
// walks the schema for it, the same source field-ref's own ConfigPanel and
// the form builder's Line Item Count picker both read to answer the
// identical "which child forms does this form's Line Items grids resolve
// to" question.
export function RelatedBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<RelatedBlockConfig>) {
  const { data: forms } = useForms()
  const { data: parentForm } = useForm(config.parent_form_id)
  const { data: childForm } = useForm(config.child_form_id)

  const eligibleChildren = generatedLineItemsChildren(resolveFormSchema(parentForm))

  const selectedKeys = new Set((config.columns ?? []).map((c) => c.key))
  const usingDefaultColumns = !config.columns || config.columns.length === 0

  // Materialised before any per-column edit for the same reason as the table
  // block's: an empty list means "every field", so editing one column while
  // the list is empty would otherwise read as deselecting all the others.
  const materialisedColumns = (): ColumnConfig[] =>
    usingDefaultColumns && childForm
      ? childForm.fields.map((f) => ({ key: f.name, label: f.label }))
      : (config.columns ?? [])

  const setColumnFormat = (key: string, number_format: NumberFormat | undefined) => {
    onChange({
      ...config,
      columns: materialisedColumns().map((c) => (c.key === key ? { ...c, number_format } : c)),
    })
  }

  const toggleColumn = (key: string, checked: boolean) => {
    const base = usingDefaultColumns && childForm ? childForm.fields.map((f) => ({ key: f.name, label: f.label })) : (config.columns ?? [])
    const next = checked
      ? [...base.filter((c) => c.key !== key), { key }]
      : base.filter((c) => c.key !== key)
    onChange({ ...config, columns: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Parent form</Label>
        <SelectMenu
          value={config.parent_form_id}
          onValueChange={(parent_form_id) => onChange({ ...config, parent_form_id, child_form_id: '', columns: [] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a form…" /></SelectTrigger>
          <SelectContent>
            {(forms ?? []).filter((f) => !f.is_line_items).map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </div>

      {config.parent_form_id && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Line Items child</Label>
          <SelectMenu
            value={config.child_form_id}
            onValueChange={(child_form_id) => onChange({ ...config, child_form_id, columns: [] })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose a child form…" /></SelectTrigger>
            <SelectContent>
              {eligibleChildren.length === 0 ? (
                <div className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                  No Line Items children found on this form.
                </div>
              ) : (
                eligibleChildren.map((el) => (
                  <SelectItem key={el.childFormId} value={el.childFormId!} className="text-xs">{el.label || el.key}</SelectItem>
                ))
              )}
            </SelectContent>
          </SelectMenu>
        </div>
      )}

      {childForm && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            Child columns <span className="font-normal">(none checked = every field)</span>
          </Label>
          <div className="flex flex-col gap-1 rounded-md border border-[hsl(var(--border))] p-2">
            {childForm.fields.filter((f) => f.type !== 'parent_link').map((f) => {
              const shown = usingDefaultColumns ? true : selectedKeys.has(f.name)
              return (
                <div key={f.name} className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex flex-1 items-center gap-2">
                    <Checkbox
                      checked={shown}
                      onCheckedChange={(checked) => toggleColumn(f.name, checked === true)}
                    />
                    {f.label}
                  </label>
                  <ColumnNumberFormat
                    disabled={!shown}
                    value={(config.columns ?? []).find((c) => c.key === f.name)?.number_format}
                    onChange={(format) => setColumnFormat(f.name, format)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          Rows per parent <span className="font-normal">(optional)</span>
        </Label>
        <Input
          type="number"
          min={0}
          value={config.limit ?? ''}
          onChange={(e) => onChange({ ...config, limit: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="Unlimited"
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}
