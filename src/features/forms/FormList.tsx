import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Database, Link2, Table2 } from 'lucide-react'
import { FormActions } from './FormActions'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { getFormLinkStatus } from './form-link-status'
import type { FormDefinition } from './types'

interface FormListProps {
  appId: string
  forms: FormDefinition[]
  canWrite: boolean
}

export function FormList({ appId, forms, canWrite }: FormListProps) {
  const formsById = useMemo(() => new Map(forms.map((form) => [form.id, form])), [forms])
  const t = useTranslation()

  return (
    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" aria-label={t('forms.list.aria')}>
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-[hsl(var(--muted))]">
          <tr className="border-b border-[hsl(var(--border))]">
            <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('forms.list.form')}</th>
            <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('forms.list.slug')}</th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('forms.list.fields')}</th>
            <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('forms.list.parent')}</th>
            <th scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('forms.list.updated')}</th>
            <th scope="col" className="w-20 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('forms.list.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--border))]">
          {forms.map((form) => {
            const parent = form.parent_form_id ? formsById.get(form.parent_form_id) : undefined
            const { isLinked } = getFormLinkStatus(form)

            return (
              <tr key={form.id} className="group hover:bg-[hsl(var(--muted))]">
                <td className="max-w-[360px] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {isLinked ? (
                      <Link2 size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" aria-label={t('forms.list.shared_from_another_app')} />
                    ) : (
                      <Database size={15} className="shrink-0 text-[hsl(var(--primary))]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <Link
                        to="/applications/$appId/forms/$formId"
                        params={{ appId, formId: form.id }}
                        className="block truncate text-sm font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]"
                      >
                        {form.name}
                      </Link>
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {isLinked
                          ? form.visibility === 'read_only'
                            ? t('forms.list.shared_read_only')
                            : t('forms.list.shared_from_another_app')
                          : form.description || t('forms.list.no_description')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{form.slug}</td>
                <td className="px-4 py-3 text-right text-sm text-[hsl(var(--foreground))]">{form.fields.length}</td>
                <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{parent?.name ?? (form.parent_form_id ? t('forms.list.missing_parent') : t('forms.list.no_parent'))}</td>
                <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">{formatDate(form.updated_at, t)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to="/applications/$appId/forms/$formId/records"
                      params={{ appId, formId: form.id }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                      title={t('forms.actions.view_records')}
                      aria-label={t('forms.list.view_records', { name: form.name })}
                    >
                      <Table2 size={14} />
                    </Link>
                    <FormActions appId={appId} form={form} canWrite={canWrite} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function formatDate(value: string, t: ReturnType<typeof useTranslation>): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? t('forms.list.not_available') : date.toLocaleDateString()
}
