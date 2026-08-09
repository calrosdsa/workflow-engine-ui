import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft, Save, FilePlus2, Eye, AlertCircle, FileText, Loader2, Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useForm, useForms, useCreateForm, useUpdateForm } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import { useFormBuilderStore, useFormMetaStore, loadForm as loadFormIntoStores, resetFormBuilder, insertParentReferenceField } from '@/features/form-builder/store'
import { Toolbox } from '@/features/form-builder/Toolbox'
import { FormBuilderDnd } from '@/features/form-builder/canvas/FormBuilderDnd'
import { FormCanvas } from '@/features/form-builder/canvas/FormCanvas'
import { ConfigPanel } from '@/features/form-builder/config/ConfigPanel'
import { FormPreviewDialog } from '@/features/form-builder/FormPreviewDialog'
import { toBuilder, toPayload } from '@/features/form-builder/serialize'
import { projectToFields, validateFormRefs } from '@/features/form-builder/projection'
import { syncLineItemsChildren } from '@/features/form-builder/lineItemsSync'
import { slugifyKey } from '@/features/form-builder/factory'
import type { VariableDecl } from '@/features/workflows/types'

interface FormBuilderPageProps {
  mode: 'new' | 'edit'
}

export function FormBuilderPage({ mode }: FormBuilderPageProps) {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { appId?: string; formId?: string }
  const appId = params.appId ?? ''
  const formId = mode === 'edit' ? params.formId : undefined
  const search = useSearch({ strict: false }) as { parentFormId?: string }
  const parentFormId = mode === 'new' ? search.parentFormId : undefined

  const { data: loaded, isLoading } = useForm(formId ?? '')
  const { data: allForms } = useForms()
  const createMutation = useCreateForm()
  const updateMutation = useUpdateForm(formId ?? '')

  const schema = useFormBuilderStore((s) => s.schema)
  const {
    name, slug, description, isDirty,
    setName, setSlug, markSaved,
  } = useFormMetaStore()

  const [slugTouched, setSlugTouched] = useState(false)
  const [parentRefSeeded, setParentRefSeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Hydrate the store from the loaded definition (edit) or reset (new).
  useEffect(() => {
    if (mode === 'edit' && loaded) {
      const b = toBuilder(loaded)
      loadFormIntoStores({ id: loaded.id, name: b.name, slug: b.slug, description: b.description, schema: b.schema })
      setSlugTouched(true) // existing slug is locked anyway
    } else if (mode === 'new') {
      resetFormBuilder()
      setSlugTouched(false)
      setParentRefSeeded(false)
    }
  }, [mode, loaded, parentFormId])

  // Auto-derive slug from name until the user edits it (new forms only).
  useEffect(() => {
    if (mode === 'new' && !slugTouched) setSlug(slugifyKey(name))
  }, [name, slugTouched, mode, setSlug])

  // Seed a new dependent form with a Form Reference field back to its parent
  // (e.g. opening "Add Dependent Form" from Employee pre-fills Punch with an
  // Employee reference) — otherwise the link only ever exists as the
  // internal parent_form_id, invisible on the canvas and never asked for a
  // value at fill time. Runs once allForms has loaded (so the parent's name
  // is known); reset() above already cleared the canvas for 'new' mode, so
  // there's nothing to clash with.
  useEffect(() => {
    if (mode !== 'new' || !parentFormId || parentRefSeeded) return
    const parent = allForms?.find((f) => f.id === parentFormId)
    if (!parent) return
    insertParentReferenceField(parent.id, parent.name)
    setParentRefSeeded(true)
  }, [mode, parentFormId, allForms, parentRefSeeded])

  // Workflow variables available for expressions/binding (from schema.variables).
  const variables: VariableDecl[] = useMemo(
    () => (schema.variables ?? []).map((v) => ({ name: v.name, type: v.type as VariableDecl['type'] })),
    [schema.variables],
  )

  const projection = useMemo(() => projectToFields(schema), [schema])

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) { setError('Form name is required'); return }
    if (!slug.trim()) { setError('Form slug is required'); return }
    if (projection.fields.length === 0) {
      setError('Add at least one data field (text, number, select, etc.) before saving.')
      return
    }

    // Form-reference fields must point at an existing form before saving.
    const validIds = new Set((allForms ?? []).map((f) => f.id))
    const refIssues = validateFormRefs(schema, validIds)
    if (refIssues.length > 0) {
      const missing = refIssues.filter((i) => i.kind === 'missing').map((i) => i.label)
      const broken = refIssues.filter((i) => i.kind === 'broken').map((i) => i.label)
      const parts: string[] = []
      if (missing.length) parts.push(`select a form for: ${missing.join(', ')}`)
      if (broken.length) parts.push(`fix unavailable references: ${broken.join(', ')}`)
      setError(`Form reference issue — ${parts.join('; ')}.`)
      return
    }

    const payload = toPayload({ name, slug, description, schema })
    try {
      if (mode === 'new') {
        const created = await createMutation.mutateAsync(
          parentFormId ? { ...payload, parent_form_id: parentFormId } : payload,
        )
        // Line Items child forms link back via parent_form_id, which only
        // exists once the parent itself has been created — sync them now,
        // then persist the resulting childFormId(s) back onto the parent's
        // layout with a follow-up update.
        const { changed, schema: syncedSchema } = await syncLineItemsChildren(schema, created.id, created.slug)
        if (changed) {
          await formsApi.update(created.id, { ...payload, layout: syncedSchema, parent_form_id: parentFormId })
        }
        markSaved()
        navigate({ to: '/applications/$appId/forms/$formId', params: { appId, formId: created.id } })
      } else if (formId) {
        const { changed, schema: syncedSchema } = await syncLineItemsChildren(schema, formId, slug)
        if (changed) {
          await updateMutation.mutateAsync({ ...payload, layout: syncedSchema })
        } else {
          await updateMutation.mutateAsync(payload)
        }
        markSaved()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(extractApiError(msg))
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending
  const parentForm = parentFormId ? allForms?.find((f) => f.id === parentFormId) : undefined

  if (mode === 'edit' && isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <button
          onClick={() => navigate({ to: '/applications/$appId/forms', params: { appId } })}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Back to forms"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm">
          <FileText size={17} />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form name"
            className="h-8 max-w-[240px] border-transparent bg-transparent text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-indigo-300"
          />
          <div className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">slug</span>
            <input
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugifyKey(e.target.value)) }}
              placeholder="table_name"
              className="w-32 bg-transparent font-mono text-[12px] text-slate-600 outline-none"
              title="Logical identifier for URLs — editable; must stay unique. The physical table is never renamed."
            />
          </div>
        </div>

        {/* Column count indicator */}
        <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500" title="Data fields that become SQL columns">
          <Table2 size={13} className="text-slate-400" />
          {projection.fields.length} {projection.fields.length === 1 ? 'column' : 'columns'}
        </div>

        {parentForm && (
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-600">
            Dependent of {parentForm.name}
          </span>
        )}

        {isDirty && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-600">Unsaved</span>}

        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
          <Eye size={14} /> Preview
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700">
          {saving ? <Loader2 size={14} className="animate-spin" /> : mode === 'new' ? <FilePlus2 size={14} /> : <Save size={14} />}
          {mode === 'new' ? 'Create Form' : 'Save'}
        </Button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Body: toolbox | canvas | config — all inside one DndContext so the
          toolbox's draggables can drop into the canvas's columns. */}
      <FormBuilderDnd>
        <div className="flex min-h-0 flex-1">
          <Toolbox />
          <FormCanvas />
          <ConfigPanel variables={variables} />
        </div>
      </FormBuilderDnd>

      <FormPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        name={name}
        schema={schema}
      />
    </div>
  )
}

// Pulls the human message out of a ky HTTPError-ish string or JSON body.
function extractApiError(msg: string): string {
  const match = msg.match(/\{.*"error"\s*:\s*"([^"]+)".*\}/)
  if (match) return match[1]
  return msg
}
