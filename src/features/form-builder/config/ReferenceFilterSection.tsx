// "LIMIT OPTIONS" block in the field config panel's Logic tab, for 'form'
// (reference) elements: summarizes the element's viewer-scoped
// referenceFilter and opens a Drawer hosting FilterBuilder in viewer mode
// (static / current_user / this_record — the closed language, no
// expressions). The panel is only the AUTHORING surface: the filter is
// stored in the field's config and enforced server-side on both the
// picker's reference-options endpoint and record writes, so removing it
// here genuinely widens which records the field accepts.

import { useMemo, useState } from 'react'
import { ListFilter, Pencil, Plus } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { FilterBuilder, newGroup, type ViewerFilterContext } from '@/features/workflows/builder/FilterBuilder'
import { useCurrentUserAttrs } from '@/features/workflows/builder/useCurrentUserAttrs'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { countFilterConditions } from '../reference-filter'
import { iterElements } from '../projection'
import type { FormElement, FormSchema } from '../schema'

interface ReferenceFilterSectionProps {
  element: FormElement
  /** The whole builder schema — sibling reference elements become the
   *  this_record hop candidates. */
  schema: FormSchema
  onChange: (patch: Partial<FormElement>) => void
}

export function ReferenceFilterSection({ element, schema, onChange }: ReferenceFilterSectionProps) {
  const t = useTranslation()
  const [open, setOpen] = useState(false)

  // The conditions' Field picker matches against the TARGET form's fields —
  // "Supplier.Area = …" is a condition on the Supplier form's area field.
  const { data: targetForm } = useFormDef(element.formRef ?? '')

  // current_user attributes come from the app's user-account form (the one
  // with "create a user with each enrollment" turned on) — see
  // useCurrentUserAttrs's own doc comment for the fail-closed/ambiguity
  // rules, shared by every current_user-capable filter section.
  const { currentUserAttrs, currentUserHint } = useCurrentUserAttrs()

  const viewerModes: ViewerFilterContext = useMemo(() => {
    const thisRecordRefs = [...iterElements(schema)]
      .filter((e) => e.component === 'form' && e.formRef && e.id !== element.id)
      .map((e) => ({ name: e.key, label: e.label || e.key, targetFormId: e.formRef! }))

    return {
      currentUserAttrs,
      currentUserHint,
      thisRecordRefs: thisRecordRefs.length > 0 ? thisRecordRefs : undefined,
    }
  }, [currentUserAttrs, currentUserHint, schema, element.id])

  const count = countFilterConditions(element.referenceFilter)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('form_config.limit_options')}</Label>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-6 gap-1 px-2 text-[11px]">
          {count > 0 ? <Pencil size={11} /> : <Plus size={11} />} {count > 0 ? t('common.edit') : t('common.add')}
        </Button>
      </div>

      {count > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
          <ListFilter size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <p className="min-w-0 flex-1 text-[11px] text-[hsl(var(--muted-foreground))]">
            {t(count === 1 ? 'form_config.condition_count_one' : 'form_config.condition_count_many', { count })} {t('form_config.enforced_on_picker_suffix')}
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
          {t('form_config.no_filter_help')}
        </p>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent size="lg">
          <DrawerHeader>
            <DrawerTitle>{t('form_config.limit_options_drawer_title', { name: element.label || element.key })}</DrawerTitle>
            <DrawerDescription>
              {t('form_config.limit_options_drawer_description')}
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1">
            <div className="p-6">
              {element.formRef ? (
                <FilterBuilder
                  group={element.referenceFilter ?? newGroup()}
                  fields={targetForm?.fields ?? []}
                  variables={[]}
                  viewerModes={viewerModes}
            allowRelativeDates
                  onChange={(referenceFilter) => onChange({ referenceFilter })}
                />
              ) : (
                <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                  {t('form_config.pick_referenced_form_first')}
                </p>
              )}
            </div>
          </ScrollArea>
          <DrawerFooter className="items-center justify-between sm:justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {t(count === 1 ? 'form_config.condition_count_one' : 'form_config.condition_count_many', { count })} {t('form_config.filter_footer_suffix')}
              </p>
              {element.referenceFilter && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-[hsl(var(--destructive))]"
                  onClick={() => onChange({ referenceFilter: undefined })}
                >
                  {t('form_config.remove_filter')}
                </Button>
              )}
            </div>
            <Button type="button" onClick={() => setOpen(false)}>{t('common.done')}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
