// The one argument prompt every run surface shares (FR-D2-019 RUN-02/RUN-03):
// the report list's Run action, the builder's Preview button, and the
// export_report custom action all render this rather than each growing their
// own form, so the required/default/range rules cannot drift between them.
import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { ReferenceFieldAutocomplete } from '@/features/forms/runtime/ReferenceFieldAutocomplete'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { FormElement } from '@/features/form-builder/schema'
import {
  initialArgumentValues,
  missingRequiredArguments,
  pruneEmptyArguments,
} from './arguments'
import type { RangeValue, ReportArgument } from './types'

interface ReportArgumentsDialogProps {
  open: boolean
  /** Only the arguments this surface actually needs to ask about — the export
   *  action resolves its `current_record` ones before opening the dialog. */
  argumentList: ReportArgument[]
  /** Values already resolved by the caller, used to seed the controls. */
  seed?: Record<string, unknown>
  /** Defaults to t('reports.run_dialog.title') when omitted. */
  title?: string
  /** Defaults to t('common.run') when omitted. */
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (values: Record<string, unknown>) => void
}

export function ReportArgumentsDialog({
  open,
  argumentList,
  seed,
  title,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: ReportArgumentsDialogProps) {
  const t = useTranslation()
  const dialogTitle = title ?? t('reports.run_dialog.title')
  const confirmButtonLabel = confirmLabel ?? t('common.run')
  const [values, setValues] = useState<Record<string, unknown>>(() => initialArgumentValues(argumentList, seed))

  // Re-seed whenever the dialog reopens so a previous run's edits never leak
  // into the next one; values are deliberately not remembered between runs.
  useEffect(() => {
    if (open) setValues(initialArgumentValues(argumentList, seed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const missing = missingRequiredArguments(argumentList, values)
  const setValue = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel() }}>
      <DialogContent
        className="sm:max-w-md"
        // A `reference` argument renders ReferenceFieldAutocomplete, whose
        // Popover content is PORTALLED out of this dialog's DOM subtree. Radix
        // judges "outside" by the DOM, not by what the user sees, so picking a
        // record from that list reads as a click outside the dialog and closes
        // it — the argument never gets set and the run never fires. Verified
        // live: clicking a company in the picker dismissed the prompt with no
        // request sent. Re-admit any interaction that started inside a popper.
        onInteractOutside={(event) => {
          if ((event.target as Element | null)?.closest?.('[data-radix-popper-content-wrapper]')) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {argumentList.length === 1
              ? t('reports.run_dialog.description_one')
              : t('reports.run_dialog.description_many', { count: argumentList.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {argumentList.map((argument) => (
            <ArgumentControl
              key={argument.key}
              argument={argument}
              value={values[argument.key]}
              onChange={(value) => setValue(argument.key, value)}
              disabled={busy}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>{t('common.cancel')}</Button>
          <Button
            onClick={() => onConfirm(pruneEmptyArguments(argumentList, values))}
            // Gated on required arguments only; the backend enforces this too,
            // this just avoids a round trip that could only fail.
            disabled={busy || missing.length > 0}
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {confirmButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ArgumentControlProps {
  argument: ReportArgument
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
}

// argument.label is author-authored per-report content (like a form field's
// label), not this dialog's own chrome — it is not run through t()/tc() here.
// Localizing it would need the same content-override scheme forms use
// (localize-schema.ts's form.<id>.field.<path> keys); reports have no
// equivalent yet, which is a separate, larger gap than this dialog's own UI.
function ArgumentControl({ argument, value, onChange, disabled }: ArgumentControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
        {argument.label}
        {argument.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
      </Label>
      <ReportArgumentInput argument={argument} value={value} onChange={onChange} disabled={disabled} />
    </div>
  )
}

/** Exported so the workflow node's config panel can map arguments with the
 *  same controls the run prompt uses — one place decides how each argument
 *  type is edited. */
export function ReportArgumentInput({ argument, value, onChange, disabled }: ArgumentControlProps) {
  const t = useTranslation()
  // A range argument shows a from/to pair — the shape the backend compiles
  // into a gte/lte pair, since no `between` operator exists.
  if (argument.range) {
    const range = (value ?? {}) as RangeValue
    const inputType = argument.type === 'number' ? 'number' : 'date'
    return (
      <div className="flex items-center gap-2">
        <Input
          type={inputType}
          aria-label={t('reports.run_dialog.range_from_aria', { label: argument.label })}
          value={(range.from as string) ?? ''}
          onChange={(e) => onChange({ ...range, from: e.target.value })}
          disabled={disabled}
          className="h-8 text-sm"
        />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{t('reports.run_dialog.range_to_separator')}</span>
        <Input
          type={inputType}
          aria-label={t('reports.run_dialog.range_to_aria', { label: argument.label })}
          value={(range.to as string) ?? ''}
          onChange={(e) => onChange({ ...range, to: e.target.value })}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  switch (argument.type) {
    case 'boolean':
      return (
        <Switch
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
          aria-label={argument.label}
        />
      )

    case 'reference':
      // Reuses the very picker a reference FIELD uses elsewhere in the
      // product, so selecting a record here is the same interaction people
      // already know. Its `field` prop is a plain value/onChange pair, so no
      // form context is needed.
      return (
        <ReferenceFieldAutocomplete
          el={{ formRef: argument.form_id } as FormElement}
          field={{ value: value ?? null, onChange }}
          disabled={disabled}
        />
      )

    case 'date':
    case 'number':
    case 'text':
    default:
      return (
        <Input
          type={argument.type === 'number' ? 'number' : argument.type === 'date' ? 'date' : 'text'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={argument.label}
          className="h-8 text-sm"
        />
      )
  }
}
