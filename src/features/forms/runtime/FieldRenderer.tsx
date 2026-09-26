import { useId } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DatePicker, DateTimePicker } from '@/components/ui/date-time-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { ReferenceFieldAutocomplete } from './ReferenceFieldAutocomplete'
import { FileFieldInput } from './FileFieldInput'
import { LineItemsGrid } from './LineItemsGrid'
import { useAuthStore } from '@/stores/auth'
import { useRoles } from '@/features/roles/hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { FormElement } from '@/features/form-builder/schema'
import type { FieldRuntimeState } from './expression-context'

interface FieldRendererProps {
  element: FormElement
  control: Control
  /** This form's own id — see FormRendererProps' doc comment. Only consumed
   *  by the 'line_items' case below. */
  formId?: string
  runtimeState: FieldRuntimeState
  error?: string
}

// Component types whose control is not ONE focusable element: a set of radios,
// a list of checkboxes, a grid, an upload widget made of several buttons. A
// `<label htmlFor>` needs a single form control to point at, so these are
// labelled as a group instead — the label becomes a plain element referenced
// by aria-labelledby, which is what a screen reader reads before announcing
// the members. Pointing a <label> at a container would be invalid HTML and is
// simply ignored by assistive tech.
const GROUP_LABELLED = new Set(['radio', 'multiselect', 'line_items', 'file', 'image'])

// Dispatches each ComponentType to a controlled input wired via react-hook-form's
// Controller. Heading/paragraph/divider/spacer render as static presentational
// blocks (no RHF wiring, no runtime-state gating — they carry no value so
// visibility toggling doesn't apply). file/image upload through
// internal/content (Garage-backed, see FileFieldInput) and write a
// FileFieldValue ({content_id, filename, content_type, size_bytes}) back —
// see field.TypeFile's doc comment (internal/forms/field/types.go) for the
// backend's authoritative shape.
export function FieldRenderer({ element: el, control, formId, runtimeState, error }: FieldRendererProps) {
  // Unique per mounted field, so two forms on one page (or the same form in a
  // dialog behind a page) can't collide on an id. Deliberately not el.key,
  // which is only unique WITHIN a schema.
  const uid = useId()

  if (['heading', 'paragraph', 'divider', 'spacer'].includes(el.component)) {
    return <PresentationalElement element={el} />
  }
  if (!runtimeState.visible) return null

  const controlId = `${uid}-control`
  const labelId = `${uid}-label`
  const helpId = el.helpText ? `${uid}-help` : undefined
  const errorId = error ? `${uid}-error` : undefined
  // Help text and the validation message are announced with the field rather
  // than being visual-only — an error nobody hears is the same bug as a label
  // nobody hears. Error last so it's read after the hint that preceded it.
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  const asGroup = GROUP_LABELLED.has(el.component)
  const labelContent = (
    <>
      {el.label}
      {runtimeState.required && (
        // The asterisk is decorative — `required` on the control is what
        // actually conveys this, so don't make a screen reader say "asterisk".
        <span aria-hidden="true" className="ml-0.5" style={{ color: 'hsl(var(--destructive))' }}>*</span>
      )}
    </>
  )

  return (
    // data-slot / data-component / data-invalid: runtime.css styling hooks
    // (the cell of a ruled form sheet); inert in the builder.
    <div data-slot="form-field" data-component={el.component} data-invalid={error ? 'true' : undefined} data-readonly={runtimeState.readOnly ? 'true' : undefined}>
      {asGroup ? (
        <span id={labelId} data-slot="form-field-label" className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{labelContent}</span>
      ) : (
        <label id={labelId} htmlFor={controlId} data-slot="form-field-label" className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {labelContent}
        </label>
      )}
      <Controller
        name={el.key}
        control={control}
        render={({ field }) => (
          <FieldInput
            el={el}
            field={field}
            formId={formId}
            control={control}
            disabled={runtimeState.readOnly}
            id={controlId}
            labelledBy={labelId}
            describedBy={describedBy}
            required={runtimeState.required}
            invalid={!!error}
          />
        )}
      />
      {el.helpText && <p id={helpId} data-slot="form-field-help" className="mt-1 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{el.helpText}</p>}
      {/* role="alert" so a validation failure is announced when it appears,
       *  not only when the field is next focused. */}
      {error && <p id={errorId} role="alert" data-slot="form-field-error" className="mt-1 text-[11px]" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}
    </div>
  )
}

// Exported for InlineFieldEditor.tsx's per-field editing on the record
// detail view — this switch never touches react-hook-form internals
// directly, only the plain {value, onChange, onBlur} shape Controller hands
// it above, so it's safe to call standalone outside any <form>/Controller
// context. `control` is the one exception: purely FORWARDED (never read) to
// the reference picker, whose filtered mode watches sibling draft values for
// cascading refetch — callers without an enclosing form omit it and the
// picker uses its legacy unfiltered path.
export function FieldInput({ el, field, formId, control, disabled, id, labelledBy, describedBy, required, invalid }: {
  el: FormElement
  field: { value: unknown; onChange: (v: unknown) => void; onBlur: () => void }
  formId?: string
  control?: Control
  disabled: boolean
  /** Accessibility wiring from FieldRenderer. All optional: InlineFieldEditor
   *  calls this standalone with its own surrounding markup, and a control with
   *  none of these behaves exactly as it did before they existed. */
  id?: string
  labelledBy?: string
  describedBy?: string
  required?: boolean
  invalid?: boolean
}) {
  const t = useTranslation()
  // Spread into whichever element is the field's actual focusable control, so
  // the <label htmlFor> above resolves and errors/hints are announced with it.
  const a11y = {
    id,
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
    'aria-invalid': invalid || undefined,
  }
  // For the multi-control types: names the whole set instead of one member.
  const groupA11y = {
    role: 'group',
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
  }

  switch (el.component) {
    case 'textarea':
    case 'richtext':
      return (
        <Textarea
          value={(field.value as string) ?? ''}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          placeholder={el.placeholder}
          disabled={disabled}
          {...a11y}
        />
      )

    case 'number':
      return (
        <Input
          type="number"
          value={(field.value as number | string) ?? ''}
          onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={field.onBlur}
          placeholder={el.placeholder}
          disabled={disabled}
          {...a11y}
        />
      )

    case 'date':
      return (
        <DatePicker
          value={(field.value as string) ?? ''}
          onChange={(v) => { field.onChange(v); field.onBlur() }}
          disabled={disabled}
          id={id}
        />
      )
    case 'time':
      return (
        <TimePicker
          value={(field.value as string) ?? ''}
          onChange={(v) => { field.onChange(v); field.onBlur() }}
          disabled={disabled}
          id={id}
        />
      )
    case 'datetime':
      return (
        <DateTimePicker
          value={(field.value as string) ?? ''}
          onChange={(v) => { field.onChange(v); field.onBlur() }}
          disabled={disabled}
          id={id}
        />
      )

    case 'checkbox':
      return (
        <Checkbox
          checked={!!field.value}
          onCheckedChange={(checked) => field.onChange(checked === true)}
          disabled={disabled}
          {...a11y}
        />
      )
    case 'switch':
      return (
        <Switch
          checked={!!field.value}
          onCheckedChange={field.onChange}
          disabled={disabled}
          {...a11y}
        />
      )

    case 'radio':
      return (
        // Radix's Root already carries role="radiogroup", which is more
        // specific than the plain "group" the other multi-control cases use —
        // so this takes only the labelling, not groupA11y's role.
        <RadioGroup
          value={(field.value as string) ?? ''}
          onValueChange={field.onChange}
          disabled={disabled}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-required={required || undefined}
        >
          {(el.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
              <RadioGroupItem value={o.value} />
              {o.label}
            </label>
          ))}
        </RadioGroup>
      )

    case 'select':
      return (
        <Select value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} disabled={disabled} {...a11y}>
          <option value="">{t('field_renderer.select_placeholder')}</option>
          {(el.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )

    case 'role':
      return <RoleFieldInput value={(field.value as string) ?? ''} onChange={field.onChange} disabled={disabled} a11y={a11y} />

    case 'multiselect': {
      const values = Array.isArray(field.value) ? (field.value as string[]) : []
      const toggle = (v: string) => {
        field.onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
      }
      return (
        <div className="space-y-1 rounded-md border p-2" style={{ borderColor: 'hsl(var(--border))' }} {...groupA11y}>
          {(el.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
              <Checkbox checked={values.includes(o.value)} onCheckedChange={() => toggle(o.value)} disabled={disabled} />
              {o.label}
            </label>
          ))}
        </div>
      )
    }

    case 'form':
      return <ReferenceFieldAutocomplete el={el} field={field} disabled={disabled} id={id} sourceFormId={formId} control={control} />

    // The remaining three are composites of several controls, so the label
    // names the wrapper rather than reaching inside to pick one of them.
    case 'line_items':
      return (
        <div {...groupA11y}>
          <LineItemsGrid el={el} field={field} parentFormId={formId} disabled={disabled} />
        </div>
      )

    case 'file':
    case 'image':
      return (
        <div {...groupA11y}>
          <FileFieldInput
            el={el}
            isImage={el.component === 'image'}
            formId={formId}
            field={field}
            disabled={disabled}
          />
        </div>
      )

    case 'hidden':
      return <input type="hidden" value={(field.value as string) ?? ''} />

    case 'email':
      return (
        <Input type="email" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} {...a11y} />
      )
    case 'url':
      return (
        <Input type="url" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} {...a11y} />
      )
    case 'password':
      return (
        <Input type="password" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} {...a11y} />
      )
    case 'phone':
      return (
        <Input type="tel" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} {...a11y} />
      )

    case 'autocomplete':
    case 'text':
    default:
      return (
        <Input value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} {...a11y} />
      )
  }
}

// A dedicated component (not inlined in FieldInput's switch) since it needs
// useRoles — a hook — scoped to the active app. Backs the 'role' component
// type, e.g. the Role field auto-injected by the "Create user with each
// enrollment" setting (see form-builder/factory.ts's createAccountSection).
function RoleFieldInput({ value, onChange, disabled, a11y }: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  /** Forwarded from FieldInput so the outer <label htmlFor> resolves to this
   *  <select> rather than to nothing. */
  a11y?: Record<string, unknown>
}) {
  const t = useTranslation()
  const appId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const { data: roles, isLoading } = useRoles(appId)

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || isLoading} {...a11y}>
      <option value="">{isLoading ? t('field_renderer.loading_roles') : t('field_renderer.select_placeholder')}</option>
      {(roles ?? []).map((r) => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </Select>
  )
}

function PresentationalElement({ element: el }: { element: FormElement }) {
  switch (el.component) {
    case 'heading': {
      const Tag = (`h${el.level ?? 2}`) as 'h1' | 'h2' | 'h3'
      return <Tag className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{el.content}</Tag>
    }
    case 'paragraph':
      return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{el.content}</p>
    case 'divider':
      return <hr style={{ borderColor: 'hsl(var(--border))' }} />
    case 'spacer':
      return <div style={{ height: el.height ?? 16 }} />
    default:
      return null
  }
}
