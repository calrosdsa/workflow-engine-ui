// A small, fresh field-list renderer for a credential TYPE's own fields
// (CredentialTypeSpec.fields — see types.ts), used by CredentialFormDialog
// (GlobalSettingsSection.tsx) to render both the 3 built-in shapes and any
// package-declared named type through one generic form instead of a
// hand-coded per-type switch.
//
// Deliberately NOT built on top of SchemaForm (the builder's generic
// node-config renderer, @/features/workflows/builder/SchemaForm): that
// component is coupled to the workflow builder (it imports
// FieldValidationIssue from configuration-workbench and hardcodes
// node-workbench-parameters.* control ids), it renders a credential-select
// picker itself (a credential picker INSIDE a credential-creation form is a
// recursion hazard), and — the blocking reason — it has no secret/password
// input at all: every string field renders as a plain Input/Textarea, which
// would silently render an Access Token field as plaintext. This form's
// `fields[].secret` flag is the thing SchemaForm's shape can't express.
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { CredentialTypeField } from './types'

interface CredentialTypeFieldFormProps {
  fields: CredentialTypeField[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

export function CredentialTypeFieldForm({ fields, values, onChange }: CredentialTypeFieldFormProps) {
  const t = useTranslation()
  return (
    <>
      {fields.map((field) => (
        <div key={field.key}>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {field.label}
            {field.required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}
          </label>
          {field.options?.length ? (
            <select
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-sm text-[hsl(var(--foreground))]"
            >
              <option value="" disabled>{t('app_settings.credentials.select_placeholder')}</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <Input
              type={field.secret ? 'password' : 'text'}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={field.secret ? 'font-mono text-xs' : undefined}
            />
          )}
        </div>
      ))}
    </>
  )
}

/** True once every Required field in fields has a non-blank value — the
 *  generic replacement for CredentialFormDialog's old per-type canSave
 *  ternary chain. */
export function credentialFieldsComplete(fields: CredentialTypeField[], values: Record<string, string>): boolean {
  return fields.every((f) => !f.required || (values[f.key] ?? '').trim() !== '')
}
