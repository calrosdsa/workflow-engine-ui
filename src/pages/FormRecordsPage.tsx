import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useForm, useFormRecords, useCreateRecord, useDeleteRecord } from '@/features/forms/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { parseLayout } from '@/features/form-builder/serialize'

async function extractError(err: unknown): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response: Response }).response
    try {
      const body = await res.json() as Record<string, unknown>
      if (typeof body.error === 'string') return body.error
      if (body.fields && typeof body.fields === 'object') {
        return 'Validation failed: ' + Object.entries(body.fields as Record<string, string>)
          .map(([k, v]) => `${k} ${v}`).join(', ')
      }
      return JSON.stringify(body)
    } catch {
      return await res.text().catch(() => res.statusText)
    }
  }
  return err instanceof Error ? err.message : String(err)
}

export function FormRecordsPage() {
  const { formId } = useParams({ from: '/shell/applications/$appId/forms/$formId/records' })
  const { data: form, isLoading: loadingForm } = useForm(formId)
  const { data: records, isLoading: loadingRecords } = useFormRecords(formId)
  const createMutation = useCreateRecord(formId)
  const deleteMutation = useDeleteRecord(formId)
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  if (loadingForm || loadingRecords) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!form) return <p className="p-6 text-red-600">Form not found</p>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{form.slug} · {records?.length ?? 0} records</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} />{showCreate ? 'Cancel' : 'New Record'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Record</CardTitle></CardHeader>
          <CardContent>
            {createError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}
            <FormRenderer
              schema={parseLayout(form.layout)}
              fields={form.fields}
              formId={formId}
              onSubmit={(data) => {
                setCreateError(null)
                createMutation.mutate(data, {
                  onSuccess: () => { setShowCreate(false); setCreateError(null) },
                  onError: (err) => {
                    extractError(err).then(setCreateError)
                  },
                })
              }}
              submitting={createMutation.isPending}
              submitLabel="Save Record"
            />
          </CardContent>
        </Card>
      )}

      {!records?.length ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500">
          No records yet.
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['id', ...form.fields.map(f => f.name), 'created_at'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((rec) => (
                  <tr key={String(rec.id)} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{String(rec.id).slice(0, 8)}…</td>
                    {form.fields.map((f) => (
                      <td key={f.name} className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                        {renderCell(rec[f.name])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {rec.created_at ? new Date(String(rec.created_at)).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7"
                        onClick={() => deleteMutation.mutate(String(rec.id))}
                      >
                        <Trash2 size={12} />
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
