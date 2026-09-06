// Renders the form an `open_form` step is waiting on. Mounted once per app
// root beside the dialog host, for the same reason.
import { useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormRenderer } from '@/features/forms/runtime/FormRenderer'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { localizeFormSchema, localizeFormName } from '@/features/form-builder/localize-schema'
import { useI18n } from '@/features/i18n/I18nProvider'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useCreateRecord } from '@/features/forms/hooks'
import { useOpenFormStore, abandonPendingForm } from './open-form-store'
import { UiWorkflowDepthContext } from './depth'

export function UiWorkflowFormHost() {
  const pending = useOpenFormStore((s) => s.pending)

  // A form nobody can see must not leave its run parked forever.
  useEffect(() => () => abandonPendingForm('the app closed the form'), [])

  if (!pending) return null
  return <OpenFormDialog key={pending.id} />
}

function OpenFormDialog() {
  const pending = useOpenFormStore((s) => s.pending)!
  const { request, settle } = pending
  const { data: form, isLoading } = useFormDef(request.formId)
  const createRecord = useCreateRecord(request.formId)
  // Also mounted in the builder entry (see this file's own top comment) —
  // that I18nProvider always has no per-app overrides (main.tsx's own
  // comment), so tc() there is a no-op passthrough to the authored text;
  // this only actually translates anything in the runtime entry.
  const { tc } = useI18n()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Closing is a real answer — "they didn't make one" — not a
        // cancellation of the run; the step's own on_cancel decides what that
        // means.
        if (!open) settle({ created: false })
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request.title || (form && localizeFormName(form.id, form.name, tc)) || 'New record'}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {isLoading || !form ? (
            <p className="py-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
          ) : (
            // Everything under here is one form deeper. FormRenderer's own
            // after-submit and field-change hooks read this, so the form's
            // workflows run at the right level without FormRenderer knowing
            // anything about being nested.
            <UiWorkflowDepthContext.Provider value={request.depth}>
              <FormRenderer
                schema={localizeFormSchema(resolveFormSchema(form), form.id, tc)}
                fields={form.fields}
                formId={form.id}
                // The step already knows the record it is attached to, which
                // is what makes this more than "go to the Add page".
                defaultValues={request.prefill}
                submitting={createRecord.isPending}
                submitLabel="Save"
                onSubmit={async (values) => {
                  // A failed save leaves the dialog OPEN with the values
                  // intact: the run is still parked, and closing it would
                  // discard what they typed and report "they didn't make one",
                  // which is not what happened. FormRenderer surfaces the
                  // error itself.
                  const created = await createRecord.mutateAsync(values)
                  settle({ created: true, recordId: String((created as { id?: unknown }).id ?? '') })
                }}
              />
            </UiWorkflowDepthContext.Provider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
