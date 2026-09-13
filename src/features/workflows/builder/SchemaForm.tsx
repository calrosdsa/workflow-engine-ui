// A generic, JSON-Schema-driven config form for pluggable connector nodes —
// see the connector architecture plan §06 for the full rationale (chosen
// over a connector-served remote UI bundle specifically to avoid the
// iframe-sandbox infrastructure the confirmed v1 trust model doesn't call
// for). This is the ONE new frontend surface a connector author gets for
// free with zero React code of their own: declare a JSON Schema in the
// manifest, get a working — if generic, not bespoke — config form.
//
// Scope, deliberately: static values only (string/number/boolean/enum). No
// expression-mode toggle (ExpressionField's static-vs-expr pattern), no
// nested object/array editing beyond one flat level. A connector needing
// more than this renders its overflow fields as raw JSON in the fallback
// textarea rather than silently dropping them — see UnsupportedField below.
import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { CredentialSelect } from '@/features/app-settings/CredentialSelect'
import type { CredentialType } from '@/features/app-settings/types'
import type { FieldValidationIssue } from './configuration-workbench'

/** A deliberately loose JSON Schema type — this form only ever reads a
 *  small, known subset of draft 2020-12 (type/properties/required/enum/
 *  title/description/default plus the x-workflow-engine-widget extension
 *  keyword below); it does not validate against the schema (that happens
 *  server-side, both in the connector's own ValidateConfig and — for the
 *  fast path — a local schema check this form does NOT perform, matching
 *  the plan's stated fast-path/RPC split). */
export interface JSONSchema {
  type?: string
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  title?: string
  description?: string
}

export interface JSONSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean'
  title?: string
  description?: string
  enum?: (string | number)[]
  default?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  format?: string
  /** Vendor extension: renders this field with the platform's own
   *  CredentialSelect picker instead of a generic string input. The only
   *  currently-supported value is "credential-select"; anything else (or
   *  absent) falls through to the type-driven default renderer. */
  'x-workflow-engine-widget'?: string
  /** Paired with x-workflow-engine-widget: "credential-select" — restricts
   *  the picker to credentials of this type, mirroring CredentialSelect's
   *  own typeFilter prop. Omit to show every credential. */
  'x-workflow-engine-credential-type'?: CredentialType | CredentialType[]
}

interface SchemaFormProps {
  schema: JSONSchema
  value: unknown
  onChange: (value: Record<string, unknown>) => void
  /** Validation comes from the workbench contract so a connector field has
   * the same inline error behavior as a built-in form. */
  issues?: FieldValidationIssue[]
}

/** True node-registry-style default-filling: every property gets its
 *  schema `default` (or a type-appropriate empty value) when the stored
 *  config is missing that key entirely — this is what lets a fresh
 *  connector node (config: {}) render a fully-populated, editable form
 *  immediately, the same way defaultConfig() does for every built-in node
 *  type. */
export function defaultsForSchema(schema: JSONSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (prop.default !== undefined) { out[key] = prop.default; continue }
    switch (prop.type) {
      case 'boolean': out[key] = false; break
      case 'number':
      case 'integer': out[key] = 0; break
      default: out[key] = ''
    }
  }
  return out
}

export function SchemaForm({ schema, value, onChange, issues = [] }: SchemaFormProps) {
  const config = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const properties = schema.properties ?? {}
  const required = useMemo(() => new Set(schema.required ?? []), [schema.required])

  const setField = (key: string, fieldValue: unknown) => {
    onChange({ ...config, [key]: fieldValue })
  }

  const entries = Object.entries(properties)
  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
        This connector declares no configurable fields.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, prop]) => (
        <SchemaField
          key={key}
          fieldKey={key}
          prop={prop}
          value={config[key]}
          required={required.has(key)}
          issue={issues.find((issue) => issue.path === `parameters.${key}`)?.message}
          onChange={(v) => setField(key, v)}
        />
      ))}
    </div>
  )
}

interface SchemaFieldProps {
  fieldKey: string
  prop: JSONSchemaProperty
  value: unknown
  required: boolean
  issue?: string
  onChange: (value: unknown) => void
}

function SchemaField({ fieldKey, prop, value, required, issue, onChange }: SchemaFieldProps) {
  const label = prop.title || humanizeKey(fieldKey)

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {label}{required && <span className="ml-0.5 text-[hsl(var(--destructive))]">*</span>}
        </Label>
      </div>
      <FieldControl fieldKey={fieldKey} prop={prop} value={value} onChange={onChange} issue={issue} />
      {prop.description && (
        <p className="text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">{prop.description}</p>
      )}
      {issue && <p className="text-[11px] text-[hsl(var(--destructive))]">{issue}</p>}
    </div>
  )
}

function FieldControl({ fieldKey, prop, value, onChange, issue }: Omit<SchemaFieldProps, 'required'>) {
  const widget = prop['x-workflow-engine-widget']
  const common = { id: `node-workbench-parameters.${fieldKey}`, 'aria-invalid': !!issue }

  if (widget === 'credential-select') {
    return (
      <CredentialSelect
        value={typeof value === 'string' ? value : undefined}
        onChange={(name) => onChange(name ?? '')}
        typeFilter={prop['x-workflow-engine-credential-type']}
        accentClassName="text-[hsl(var(--foreground))]"
      />
    )
  }

  if (prop.enum && prop.enum.length > 0) {
    return (
      <Select
        {...common}
        value={String(value ?? '')}
        onChange={(e) => onChange(coerceEnumValue(e.target.value, prop.enum!))}
        className="h-8 text-[12px]"
      >
        <option value="" disabled>Select…</option>
        {prop.enum.map((opt) => (
          <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
        ))}
      </Select>
    )
  }

  switch (prop.type) {
    case 'boolean':
      return (
        <div className="flex h-8 items-center">
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      )
    case 'number':
    case 'integer':
      return (
        <Input
          {...common}
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="h-8 text-[12px]"
        />
      )
    default:
      // A long-form field (title/description hints at multi-line intent) gets
      // a textarea; everything else is a single-line input — the same
      // heuristic ShowMessageForm's own message field already uses.
      if (looksMultiline(fieldKey, prop)) {
        return (
          <Textarea
            {...common}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-16 text-[12px]"
          />
        )
      }
      return (
        <Input
          {...common}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-[12px]"
        />
      )
  }
}

function coerceEnumValue(raw: string, options: (string | number)[]): string | number {
  const match = options.find((o) => String(o) === raw)
  return match ?? raw
}

function looksMultiline(key: string, prop: JSONSchemaProperty): boolean {
  const hint = `${key} ${prop.title ?? ''} ${prop.description ?? ''}`.toLowerCase()
  return /body|message|content|text|template|description|notes?/.test(hint)
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Wraps SchemaForm as a NodeFormProps-compatible component for
 *  NodeConfigPanel's dispatch — bound to one connector's schema via a
 *  closure, matching how every built-in node type's `form` field is a
 *  concrete component, not a generic one taking a schema prop directly
 *  (NodeFormProps has no schema field, by design — see node-registry.ts). */
export function makeConnectorForm(schema: JSONSchema) {
  return function ConnectorNodeForm({ config, onChange }: { config: unknown; onChange: (c: unknown) => void }) {
    return <SchemaForm schema={schema} value={config} onChange={onChange} />
  }
}
