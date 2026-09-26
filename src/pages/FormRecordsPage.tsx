import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useForm, useFormRecords, useCreateRecord, useDeleteRecord } from '@/features/forms/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { HTTPError } from 'ky'
import { useI18n } from '@/features/i18n/I18nProvider'
import { extractApiError } from '@/lib/api'

// ky has already read an error response's body into HTTPError.data, so the
// response itself can't be read again (doing so fell back to the bare status
// text, "Forbidden" or "Internal Server Error", losing the server's message
// and a 5xx's request id).
function extractError(err: unknown, validationFailed: string): string {
  if (err instanceof HTTPError) {
    const data = err.data as { error?: string; fields?: Record<string, string> } | undefined
    if (!data?.error && data?.fields && typeof data.fields === 'object') {
      return validationFailed + Object.entries(data.fields).map(([k, v]) => `${k} ${v}`).join(', ')
    }
  }
  return extractApiError(err)
}

export function FormRecordsPage() {
  const { t, locale } = useI18n()
  const { formId } = useParams({ from: '/shell/applications/$appId/forms/$formId/records' })
  const { data: form, isLoading: loadingForm } = useForm(formId)
  const { data: records, isLoading: loadingRecords } = useFormRecords(formId)
  const createMutation = useCreateRecord(formId)
  const deleteMutation = useDeleteRecord(formId)
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  if (loadingForm || loadingRecords) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!form) return <p className="p-6 text-[hsl(var(--destructive))]">{t('records.not_found')}</p>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{form.name}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 font-mono">{form.slug} · {t('common.records', { count: records?.length ?? 0 })}</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} />{showCreate ? t('common.cancel') : t('records.new')}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('records.new')}</CardTitle></CardHeader>
          <CardContent>
            {createError && (
              <div className="mb-3 rounded-md bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/30 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
                {createError}
              </div>
            )}
            <FormRenderer
              schema={resolveFormSchema(form)}
              fields={form.fields}
              formId={formId}
              onSubmit={(data) => {
                setCreateError(null)
                createMutation.mutate(data, {
                  onSuccess: () => { setShowCreate(false); setCreateError(null) },
                  onError: (err) => setCreateError(extractError(err, t('records.validation_failed'))),
                })
              }}
              submitting={createMutation.isPending}
              submitLabel={t('records.save')}
            />
          </CardContent>
        </Card>
      )}

      {!records?.length ? (
        <div className="rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--muted-foreground))]">
          {t('records.no_records')}
        </div>
      ) : (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[hsl(var(--border))]">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  {['id', ...form.fields.map(f => f.name), 'created_at'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {records.map((rec) => (
                  <tr key={String(rec.id)} className="hover:bg-[hsl(var(--muted))]">
                    <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{String(rec.id).slice(0, 8)}…</td>
                    {form.fields.map((f) => (
                      <td key={f.name} className="px-4 py-3 text-sm text-[hsl(var(--foreground))] max-w-xs truncate">
                        {renderCell(rec[f.name])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {rec.created_at ? new Date(String(rec.created_at)).toLocaleDateString(locale) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 h-7 w-7"
                        onClick={() => deleteMutation.mutate(String(rec.id))}
                        aria-label={t('records.delete')}
                        title={t('records.delete')}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
