import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeft, Save, FilePlus2, Eye, AlertCircle, FileText, Loader2, Table2, Redo2, Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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

// Mirrors dashboard/DashboardEditorPage.tsx's own isEditableTarget (FR-C3-009):
// Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z must not hijack the browser's native
// undo/redo while the user is typing in a text field (a section title, a
// config panel input) — checked against the event's real target, not
// assumed from context, since focus can be anywhere when the shortcut fires.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
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
  const undo = useFormBuilderStore((s) => s.undo)
  const redo = useFormBuilderStore((s) => s.redo)
  const canUndo = useFormBuilderStore((s) => s.canUndo)
  const canRedo = useFormBuilderStore((s) => s.canRedo)
  const {
    name, slug, description, isDirty, parentFormId: loadedParentFormId,
    setName, setSlug, markSaved,
  } = useFormMetaStore()

  const [slugTouched, setSlugTouched] = useState(false)
  const [parentRefSeeded, setParentRefSeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  // Guards the one reachable in-app path that would otherwise silently
  // discard unsaved work: the header's "Back to forms" button. beforeunload
  // (below) already covers tab-close/refresh/typed-URL navigation, but that
  // event never fires for TanStack Router's own client-side navigation, so
  // this in-app path needed its own guard — nothing in this codebase
  // protects it today (confirmed against DashboardEditorPage.tsx, the
  // closest sibling builder, which has the same gap).
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  // Tracks whether the hydration effect below has actually run for the
  // CURRENT loaded form — deliberately separate from React Query's own
  // isLoading, which flips to false the instant `loaded` arrives, i.e. one
  // render before this effect (which only runs after commit) gets a chance
  // to populate the builder stores. Gating the canvas's mount on isLoading
  // alone let FormBuilderDnd/FormCanvas mount and subscribe to the store
  // while it still held the empty initial schema, so their first paint
  // rendered "Start building your form" even though loaded already had real
  // sections — a real, live-reproduced bug, not a display artifact. Mirrors
  // DashboardEditorPage.tsx's identical `initialised` guard for the same
  // race (FR-C3-009's own store).
  const [initialised, setInitialised] = useState(false)

  // Hydrate the store from the loaded definition (edit) or reset (new).
  useEffect(() => {
    if (mode === 'edit' && loaded) {
      const b = toBuilder(loaded)
      loadFormIntoStores({ id: loaded.id, name: b.name, slug: b.slug, description: b.description, parentFormId: loaded.parent_form_id, schema: b.schema })
      setSlugTouched(true) // existing slug is locked anyway
      setInitialised(true)
    } else if (mode === 'new') {
      resetFormBuilder()
      setSlugTouched(false)
      setParentRefSeeded(false)
      setInitialised(true)
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
        toast.success(`"${name}" created`)
        navigate({ to: '/applications/$appId/forms/$formId', params: { appId, formId: created.id } })
      } else if (formId) {
        const { changed, schema: syncedSchema } = await syncLineItemsChildren(schema, formId, slug)
        // toPayload() never carries parent_form_id (it's not part of the
        // builder's own schema/name/slug/description shape) — re-attach it
        // from the meta store's loaded value on every save, the same way the
        // 'new' branch above re-attaches it from the URL param. Without this,
        // ANY save of an existing dependent child form (even one that never
        // touches the parent-link field) silently clears parent_form_id,
        // since an update payload with no key for it is treated as "unset".
        const withParent = loadedParentFormId ? { ...payload, parent_form_id: loadedParentFormId } : payload
        if (changed) {
          await updateMutation.mutateAsync({ ...withParent, layout: syncedSchema })
        } else {
          await updateMutation.mutateAsync(withParent)
        }
        markSaved()
        toast.success('Form saved')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(extractApiError(msg))
    }
  }

  // Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z — bound once via refs to undo/redo (not in
  // this effect's dependency array) so the listener doesn't re-bind every
  // time the undo/redo stacks change. Guarded by isEditableTarget so the
  // browser's own native undo inside a text field isn't hijacked. Mirrors
  // DashboardEditorPage.tsx's identical wiring (FR-C3-009).
  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isEditableTarget(e.target)) return
        e.preventDefault()
        if (e.shiftKey) {
          redoRef.current()
        } else {
          undoRef.current()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Covers tab close/refresh/typed-URL navigation — mirrors
  // DashboardEditorPage.tsx's identical guard. Does NOT cover TanStack
  // Router's own client-side navigation (that event never fires for SPA
  // nav), which is what handleBackClick below guards separately.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const goToFormsList = () => navigate({ to: '/applications/$appId/forms', params: { appId } })
  const handleBackClick = () => {
    if (isDirty) {
      setConfirmingLeave(true)
    } else {
      goToFormsList()
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending
  const parentForm = parentFormId ? allForms?.find((f) => f.id === parentFormId) : undefined

  if ((mode === 'edit' && isLoading) || !initialised) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading form…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4">
        <button
          onClick={handleBackClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          title="Back to forms"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm">
          <FileText size={17} />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form name"
            className="h-8 max-w-[240px] border-transparent bg-transparent text-sm font-semibold text-[hsl(var(--foreground))] hover:border-[hsl(var(--border))] focus:border-[hsl(var(--ring))]"
          />
          <div className="flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">slug</span>
            <input
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugifyKey(e.target.value)) }}
              placeholder="table_name"
              className="w-32 bg-transparent font-mono text-[12px] text-[hsl(var(--muted-foreground))] outline-none"
              title="Logical identifier for URLs — editable; must stay unique. The physical table is never renamed."
            />
          </div>
        </div>

        {/* Column count indicator */}
        <div className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--muted))] px-2.5 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))]" title="Data fields that become SQL columns">
          <Table2 size={13} className="text-[hsl(var(--muted-foreground))]" />
          {projection.fields.length} {projection.fields.length === 1 ? 'column' : 'columns'}
        </div>

        {parentForm && (
          <span className="rounded-full bg-[hsl(var(--primary))]/15 px-2 py-1 text-[11px] font-medium text-[hsl(var(--primary))]">
            Dependent of {parentForm.name}
          </span>
        )}

        {isDirty && <span className="rounded-full bg-[hsl(var(--warning))]/15 px-2 py-1 text-[11px] font-medium text-[hsl(var(--warning))]">Unsaved</span>}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
          <Eye size={14} /> Preview
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : mode === 'new' ? <FilePlus2 size={14} /> : <Save size={14} />}
          {saving ? (mode === 'new' ? 'Creating…' : 'Saving…') : mode === 'new' ? 'Create Form' : 'Save'}
        </Button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 border-b border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-2 text-[12px] text-[hsl(var(--destructive))]">
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
        formId={formId}
      />

      <ConfirmDialog
        open={confirmingLeave}
        onOpenChange={setConfirmingLeave}
        title="Discard unsaved changes?"
        description="You have unsaved changes to this form. Leaving now will discard them — this can't be undone."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => { setConfirmingLeave(false); goToFormsList() }}
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
