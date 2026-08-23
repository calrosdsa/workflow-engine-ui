import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { COLUMN_LAYOUTS } from '@/features/form-builder/schema'
import { iterElements } from '@/features/form-builder/projection'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import { buildZodSchema } from './schema-to-zod'
import { schemaToVariableDecls, useExpressionRuntimeState, getFieldRuntimeState } from './expression-context'
import { FieldRenderer } from './FieldRenderer'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FieldDef } from '@/features/forms/types'

// react-hook-form leaves an unregistered field `undefined` until first
// touched, and JSON.stringify silently DROPS undefined-valued keys — so an
// unchecked checkbox's `sample_values` override never reaches the backend's
// expression evaluator, which then falls back to its own type placeholder
// (`true` for booleans) instead of the real unchecked state. Every
// data-bearing field needs a defined, type-appropriate default from the
// first render so live expression evaluation reflects reality immediately.
function emptyDefaults(schema: FormSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const el of iterElements(schema)) {
    // Line Items isn't dataBearing (it doesn't project to a single FieldDef
    // column — it's a nested child-record array), but it still needs a
    // defined value from first render, same reasoning as every other field.
    if (el.component === 'line_items') {
      out[el.key] = []
      continue
    }
    const reg = COMPONENT_REGISTRY[el.component]
    if (!reg.dataBearing) continue
    if (reg.fieldType === 'boolean') out[el.key] = false
    else if (reg.fieldType === 'json') out[el.key] = el.component === 'multiselect' ? [] : null
    // 'reference' columns are real Postgres uuid foreign keys, not text —
    // sending '' for an unset one 500s with "invalid input syntax for type
    // uuid" (see nullsToEmptyStrings above for the full explanation).
    else if (reg.fieldType === 'reference') out[el.key] = null
    else out[el.key] = ''
  }
  return out
}

// A real record's SQL NULLs (unset text/enum columns) arrive as `null`,
// which schema-to-zod's z.string() rejects outright (it only allows '' or a
// real string) — every other value came through emptyDefaults(), which
// never produces null for a string-shaped field. Editing an existing record
// with an unset field is the only path that surfaces this: the Add page
// always starts from emptyDefaults() alone, so it never carries a raw null
// in. Coercing null -> '' here keeps the merge below type-safe for every
// field the schema-to-zod string branch (schema-to-zod.ts:32) covers.
//
// 'reference' is excluded even though it also falls into that string
// branch: its physical column is a real Postgres uuid (a foreign key), not
// text, so an unset reference must stay null on submit — sending '' 500s
// with "invalid input syntax for type uuid" (confirmed against the
// backend's marshalArg). ReferenceFieldAutocomplete already treats
// value ?? '' as its own internal empty-selection sentinel for display, so
// leaving the underlying form value null doesn't break that component.
function nullsToEmptyStrings(schema: FormSchema, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values }
  for (const el of iterElements(schema)) {
    const reg = COMPONENT_REGISTRY[el.component]
    if (!reg.dataBearing || reg.fieldType === 'json' || reg.fieldType === 'boolean' || reg.fieldType === 'reference') continue
    if (out[el.key] === null) out[el.key] = ''
  }
  return out
}

export interface FormRendererProps {
  schema: FormSchema
  fields: FieldDef[]
  /** This form's own id — threaded down to a 'line_items' field so it can
   *  permission-check row actions against the right form (an adopted row's
   *  OWN form permission, or this form's for a generated row/the grid
   *  itself). Optional only for FormRendererHarness's ad-hoc dev preview,
   *  where Line Items permission checks aren't meaningful. */
  formId?: string
  defaultValues?: Record<string, unknown>
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>
  submitting?: boolean
  submitLabel?: string
}

// The end-user-facing counterpart to the admin's form-builder canvas —
// renders an actual fillable form (react-hook-form + zod) from the same
// FormSchema the builder produces, respecting the same
// validation/visibility/required/readOnly rules the builder lets an admin
// configure. This is the piece Add Menu depends on; no runtime form-fill
// renderer existed anywhere in the codebase before this.
export function FormRenderer({ schema, formId, defaultValues, onSubmit, submitting, submitLabel }: FormRendererProps) {
  const zodSchema = buildZodSchema(schema)
  const variables = schemaToVariableDecls(schema)

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues: { ...emptyDefaults(schema), ...nullsToEmptyStrings(schema, defaultValues ?? {}) },
  })

  const liveValues = useWatch({ control }) as Record<string, unknown>

  const expressionInputs = [...iterElements(schema)].flatMap((el) => [
    { key: el.key, kind: 'visibleWhen' as const, expr: el.behavior.visibility === 'expression' ? el.behavior.visibleWhen : undefined },
    { key: el.key, kind: 'requiredWhen' as const, expr: el.behavior.required === 'expression' ? el.behavior.requiredWhen : undefined },
    { key: el.key, kind: 'readOnlyWhen' as const, expr: el.behavior.readOnly === 'expression' ? el.behavior.readOnlyWhen : undefined },
  ])
  const runtimeStates = useExpressionRuntimeState(expressionInputs, variables, liveValues ?? {})

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className="space-y-6">
      {schema.sections.map((section) => (
        <div key={section.id}>
          {section.title && <h3 className="mb-3 text-sm font-semibold text-slate-800">{section.title}</h3>}
          {section.description && <p className="mb-3 text-xs text-gray-500">{section.description}</p>}
          {/* A 2/3/4-column section layout (COLUMN_LAYOUTS — all real,
           *  builder-selectable options) has no room to sit side by side on
           *  a phone: a flex row with no wrap/breakpoint here forced every
           *  column into a squeezed sliver of the viewport. Below `md` this
           *  stacks to one full-width column per row instead — the ratio
           *  only makes sense once columns are actually side by side, so
           *  each column falls back to `flex: 1` (no grow race) at stacked
           *  width and only takes on its configured ratio at `md:` via the
           *  `md:flex-[var(...)]` arbitrary-property/CSS-var pairing (the
           *  ratio is set per-render, so it can't be a static Tailwind
           *  class — this is the one way to still gate an inline value by
           *  breakpoint). */}
          <div className="flex flex-col gap-4 md:flex-row">
            {section.columns.map((column) => {
              const ratios = COLUMN_LAYOUTS[section.layout]?.ratios ?? [1]
              const idx = section.columns.indexOf(column)
              return (
                <div
                  key={column.id}
                  className="min-w-0 flex-1 space-y-4 md:flex-[var(--col-ratio)]"
                  style={{ '--col-ratio': ratios[idx] ?? 1 } as React.CSSProperties}
                >
                  {column.elements.map((el) => {
                    // visibility.hidden = never shown at all (distinct from
                    // an expression resolving false); handled here rather
                    // than baked into runtimeState since it's a static rule.
                    if (el.behavior.visibility === 'hidden') return null
                    const runtimeState = el.behavior.visibility === 'expression'
                      ? getFieldRuntimeState(runtimeStates, el.key)
                      : { visible: true, required: el.behavior.required === 'always', readOnly: el.behavior.readOnly === 'always' }
                    // For expression-mode required/readOnly on an otherwise
                    // static-visibility field, still consult the resolved state.
                    const resolvedRequired = el.behavior.required === 'expression'
                      ? getFieldRuntimeState(runtimeStates, el.key).required
                      : runtimeState.required
                    const resolvedReadOnly = el.behavior.readOnly === 'expression'
                      ? getFieldRuntimeState(runtimeStates, el.key).readOnly
                      : runtimeState.readOnly

                    return (
                      <FieldRenderer
                        key={el.id}
                        element={el}
                        control={control}
                        formId={formId}
                        runtimeState={{ visible: runtimeState.visible, required: resolvedRequired, readOnly: resolvedReadOnly }}
                        error={errors[el.key]?.message as string | undefined}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Button type="submit" disabled={submitting} className="gap-1.5">
        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
        {submitLabel ?? 'Submit'}
      </Button>
    </form>
  )
}
