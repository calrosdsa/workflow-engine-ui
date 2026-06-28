import { Link } from '@tanstack/react-router'
import { Plus, Trash2, Database, ExternalLink } from 'lucide-react'
import { useForms, useDeleteForm } from '@/features/forms/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { FormDefinition } from '@/features/forms/types'

export function FormsPage() {
  const { data: forms, isLoading } = useForms()
  const deleteMutation = useDeleteForm()

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Builder</h1>
          <p className="text-sm text-gray-500 mt-1">{forms?.length ?? 0} forms</p>
        </div>
        <Link to="/forms/new">
          <Button><Plus size={16} />New Form</Button>
        </Link>
      </div>

      {!forms?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Database size={32} className="text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">No forms yet. Create one to auto-generate a Postgres table.</p>
          <Link to="/forms/new">
            <Button variant="outline"><Plus size={16} />Create your first form</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <FormCard key={form.id} form={form} onDelete={() => deleteMutation.mutate(form.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FormCard({ form, onDelete }: { form: FormDefinition; onDelete: () => void }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{form.name}</CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{form.slug}</CardDescription>
          </div>
          <Link to="/forms/$formId" params={{ formId: form.id }}>
            <Button variant="ghost" size="icon"><ExternalLink size={14} /></Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {form.description && <p className="text-sm text-gray-600 mb-2">{form.description}</p>}
        <p className="text-xs text-gray-400">{form.fields.length} fields</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {form.fields.slice(0, 4).map((f) => (
            <span key={f.name} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{f.name}</span>
          ))}
          {form.fields.length > 4 && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">+{form.fields.length - 4} more</span>
          )}
        </div>
      </CardContent>
      <div className="flex gap-2 border-t p-4">
        <Link to="/forms/$formId/records" params={{ formId: form.id }} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <Database size={14} />View Records
          </Button>
        </Link>
        <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  )
}
