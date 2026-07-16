import { Controller, type Control } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ReferenceFieldAutocomplete } from './ReferenceFieldAutocomplete'
import { LineItemsGrid } from './LineItemsGrid'
import { useAuthStore } from '@/stores/auth'
import { useRoles } from '@/features/roles/hooks'
import type { FormElement } from '@/features/form-builder/schema'
import type { FieldRuntimeState } from './expression-context'

interface FieldRendererProps {
  element: FormElement
  control: Control
  runtimeState: FieldRuntimeState
  error?: string
}

// Dispatches each ComponentType to a controlled input wired via react-hook-form's
// Controller. Heading/paragraph/divider/spacer render as static presentational
// blocks (no RHF wiring, no runtime-state gating — they carry no value so
// visibility toggling doesn't apply). No file-upload backend endpoint exists
// yet in this codebase, so file/image render as a URL-entry fallback matching
// field.TypeFile's documented {name,url,size,mime} shape — real upload
// infrastructure is out of scope for the App Builder and should be its own
// follow-up.
export function FieldRenderer({ element: el, control, runtimeState, error }: FieldRendererProps) {
  if (['heading', 'paragraph', 'divider', 'spacer'].includes(el.component)) {
    return <PresentationalElement element={el} />
  }
  if (!runtimeState.visible) return null

  const label = (
    <label className="mb-1 block text-xs font-medium text-gray-600">
      {el.label}
      {runtimeState.required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )

  return (
    <div>
      {label}
      <Controller
        name={el.key}
        control={control}
        render={({ field }) => (
          <FieldInput el={el} field={field} disabled={runtimeState.readOnly} />
        )}
      />
      {el.helpText && <p className="mt-1 text-[11px] text-gray-400">{el.helpText}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

function FieldInput({ el, field, disabled }: {
  el: FormElement
  field: { value: unknown; onChange: (v: unknown) => void; onBlur: () => void }
  disabled: boolean
}) {
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
        />
      )

    case 'date':
      return (
        <Input
          type="date"
          value={(field.value as string) ?? ''}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          disabled={disabled}
        />
      )
    case 'time':
      return (
        <Input
          type="time"
          value={(field.value as string) ?? ''}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          disabled={disabled}
        />
      )
    case 'datetime':
      return (
        <Input
          type="datetime-local"
          value={(field.value as string) ?? ''}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          disabled={disabled}
        />
      )

    case 'checkbox':
      return (
        <Checkbox
          checked={!!field.value}
          onCheckedChange={(checked) => field.onChange(checked === true)}
          disabled={disabled}
        />
      )
    case 'switch':
      return (
        <Switch
          checked={!!field.value}
          onCheckedChange={field.onChange}
          disabled={disabled}
        />
      )

    case 'radio':
      return (
        <RadioGroup value={(field.value as string) ?? ''} onValueChange={field.onChange} disabled={disabled}>
          {(el.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
              <RadioGroupItem value={o.value} />
              {o.label}
            </label>
          ))}
        </RadioGroup>
      )

    case 'select':
      return (
        <Select value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} disabled={disabled}>
          <option value="">Select…</option>
          {(el.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      )

    case 'role':
      return <RoleFieldInput value={(field.value as string) ?? ''} onChange={field.onChange} disabled={disabled} />

    case 'multiselect': {
      const values = Array.isArray(field.value) ? (field.value as string[]) : []
      const toggle = (v: string) => {
        field.onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
      }
      return (
        <div className="space-y-1 rounded-md border border-gray-200 p-2">
          {(el.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={values.includes(o.value)} onCheckedChange={() => toggle(o.value)} disabled={disabled} />
              {o.label}
            </label>
          ))}
        </div>
      )
    }

    case 'form':
      return <ReferenceFieldAutocomplete el={el} field={field} disabled={disabled} />

    case 'line_items':
      return <LineItemsGrid el={el} field={field} disabled={disabled} />

    case 'file':
    case 'image':
      return (
        <Input
          value={(field.value as { url?: string } | undefined)?.url ?? ''}
          onChange={(e) => field.onChange({ url: e.target.value })}
          onBlur={field.onBlur}
          placeholder="https://…"
          disabled={disabled}
        />
      )

    case 'hidden':
      return <input type="hidden" value={(field.value as string) ?? ''} />

    case 'email':
      return (
        <Input type="email" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} />
      )
    case 'url':
      return (
        <Input type="url" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} />
      )
    case 'password':
      return (
        <Input type="password" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} />
      )
    case 'phone':
      return (
        <Input type="tel" value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} />
      )

    case 'autocomplete':
    case 'text':
    default:
      return (
        <Input value={(field.value as string) ?? ''} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} placeholder={el.placeholder} disabled={disabled} />
      )
  }
}

// A dedicated component (not inlined in FieldInput's switch) since it needs
// useRoles — a hook — scoped to the active app. Backs the 'role' component
// type, e.g. the Role field auto-injected by the "Create user with each
// enrollment" setting (see form-builder/factory.ts's createAccountSection).
function RoleFieldInput({ value, onChange, disabled }: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const appId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const { data: roles, isLoading } = useRoles(appId)

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled || isLoading}>
      <option value="">{isLoading ? 'Loading roles…' : 'Select…'}</option>
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
      return <Tag className="font-semibold text-slate-800">{el.content}</Tag>
    }
    case 'paragraph':
      return <p className="text-sm text-slate-600">{el.content}</p>
    case 'divider':
      return <hr className="border-gray-200" />
    case 'spacer':
      return <div style={{ height: el.height ?? 16 }} />
    default:
      return null
  }
}
