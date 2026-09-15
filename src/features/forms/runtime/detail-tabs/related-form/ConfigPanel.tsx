// Form Builder-side config UI for the related_form tab type — target form +
// field picker (restricted, like the Line Items "adopted form" picker
// already is, to forms/fields that actually reference the owning form back),
// an optional additional filter (FilterBuilder, hideExpressions — same
// treatment SaveViewDialog's Edit View filter already gets, since this is
// end-user-facing config, not workflow-canvas scripting), a sort list, and
// a hide-when-empty toggle.
import { useMemo } from 'react'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { Field } from '@/features/form-builder/config/ConfigPanel'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { SortRuleList } from '@/components/ui/sort-rule-list'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { DetailTabConfigPanelProps } from '../contract'
import type { RelatedFormTabConfig } from './schema'
import type { FilterGroup, SortRule } from '@/features/workflows/types'

function ensureGroupIds(g: FilterGroup | undefined): FilterGroup {
  if (!g) return newGroup()
  return {
    id: g.id ?? nanoid(),
    combinator: g.combinator ?? 'and',
    conditions: (g.conditions ?? []).map((c) => ({ ...c, id: c.id ?? nanoid() })),
    groups: (g.groups ?? []).map(ensureGroupIds),
  }
}

function ensureSortIds(sort: SortRule[] | undefined): SortRule[] {
  return (sort ?? []).map((s) => ({ ...s, id: s.id ?? nanoid() }))
}

export function RelatedFormConfigPanel({ config, onChange, formId }: DetailTabConfigPanelProps<RelatedFormTabConfig>) {
  const t = useTranslation()
  const { data: targetForm } = useFormDef(config.targetFormId)

  // Only reference fields on the target form that actually point back at
  // the OWNING form — the same restriction FormReferenceSelect's own
  // requireReferenceTo prop applies to the form picker above, applied here
  // one level down to the field picker, so an admin can never configure an
  // invalid (form, field) pair (FR-D2-015 §3's validation-rules cell).
  const validTargetFields = useMemo(
    () => (targetForm?.fields ?? []).filter((f) => f.type === 'reference' && f.reference_table === formId),
    [targetForm, formId],
  )

  const fieldsWithSystem = targetForm?.fields ?? []
  const filter = ensureGroupIds(config.additionalFilter)
  const sort = ensureSortIds(config.sort)

  return (
    <div className="space-y-4">
      <Field label={t('related_form.config.show_records_from')} hint={t('related_form.config.show_records_hint')}>
        <FormReferenceSelect
          value={config.targetFormId || undefined}
          excludeId={formId}
          requireReferenceTo={formId}
          onChange={(targetFormId) => onChange({ ...config, targetFormId: targetFormId ?? '', targetFieldName: '' })}
        />
      </Field>

      {config.targetFormId && (
        <Field label={t('related_form.config.linked_via_field')} hint={t('related_form.config.linked_via_hint')}>
          {validTargetFields.length === 0 ? (
            <p className="text-[11px] text-slate-400">{t('related_form.config.no_reference_field')}</p>
          ) : (
            <SelectMenu
              value={config.targetFieldName || undefined}
              onValueChange={(targetFieldName) => onChange({ ...config, targetFieldName })}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('related_form.config.select_a_field_placeholder')} /></SelectTrigger>
              <SelectContent>
                {validTargetFields.map((f) => (
                  <SelectItem key={f.name} value={f.name} className="text-xs">{f.label || f.name}</SelectItem>
                ))}
              </SelectContent>
            </SelectMenu>
          )}
        </Field>
      )}

      {config.targetFormId && config.targetFieldName && (
        <>
          <Field label={t('related_form.config.additional_filter')} hint={t('related_form.config.additional_filter_hint')}>
            <div className="overflow-x-auto">
              <FilterBuilder
                group={filter}
                fields={fieldsWithSystem}
                variables={[]}
                onChange={(g) => onChange({ ...config, additionalFilter: g })}
                hideExpressions
              />
            </div>
          </Field>

          <Field label={t('related_form.config.sort')}>
            <SortRuleList
              rules={sort}
              fields={fieldsWithSystem.map((f) => ({ name: f.name, label: f.label }))}
              onChange={(s) => onChange({ ...config, sort: s })}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={!!config.hideWhenEmpty}
              onCheckedChange={(v) => onChange({ ...config, hideWhenEmpty: !!v })}
            />
            <Label className="cursor-pointer text-[12px] font-normal text-slate-600">{t('related_form.config.hide_when_empty')}</Label>
          </label>
        </>
      )}
    </div>
  )
}
