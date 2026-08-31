import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useForms, useForm } from '@/features/forms/hooks'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import type { RelatedBlockConfig } from './schema'

// Config surface for the "related" block type (FR-J1-002 §1): a parent-form
// picker, then a child-form picker restricted to forms that are GENERATED
// Line Items children of the selected parent (is_line_items && parent_form_id
// matches) — the same "restrict the picker to only legal choices" precedent
// trigger_workflow's own ConfigPanel already establishes (FR-D2-017), rather
// than letting an author pick an unrelated form that would fail server-side
// validation at generation time.
export function RelatedBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<RelatedBlockConfig>) {
  const { data: forms } = useForms()
  const { data: childForm } = useForm(config.child_form_id)

  const eligibleChildren = (forms ?? []).filter(
    (f) => f.is_line_items && f.parent_form_id === config.parent_form_id,
  )

  const selectedKeys = new Set((config.columns ?? []).map((c) => c.key))
  const usingDefaultColumns = !config.columns || config.columns.length === 0

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
                eligibleChildren.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
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
            {childForm.fields.filter((f) => f.type !== 'parent_link').map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={usingDefaultColumns ? true : selectedKeys.has(f.name)}
                  onCheckedChange={(checked) => toggleColumn(f.name, checked === true)}
                />
                {f.label}
              </label>
            ))}
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
