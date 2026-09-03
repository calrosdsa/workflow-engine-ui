import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { COLUMN_LAYOUTS } from '@/features/form-builder/schema'
import { iterElements } from '@/features/form-builder/projection'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import { buildZodSchema } from './schema-to-zod'
import { schemaToVariableDecls, useExpressionRuntimeState, getFieldRuntimeState } from './expression-context'
import { useCurrentViewer } from './detail-tabs/useTabVisible'
import { resolveAdvancedSettings, NO_EFFECTS } from './advanced-settings'
import { useUiWorkflowHost } from '@/features/ui-workflows/useUiWorkflowHost'
import { useFieldChangeWorkflow } from '@/features/ui-workflows/useFieldChangeWorkflow'
import type { FieldStatePatch } from '@/features/ui-workflows/host'
import { FieldRenderer } from './FieldRenderer'
import { FormSectionShell, shouldChromeSections } from './FormSectionShell'
import type { AdvancedFieldEffects } from './advanced-settings'
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
    // 'file' (File Upload / Image Upload, FR-C1-012) is a real Postgres
    // JSONB column, same as 'json' above — sending '' 500s with "invalid
    // input syntax for type json". schema-to-zod's file case is itself
    // `.nullable()`, so null is the correct unset representation, not ''.
    // Confirmed live: submitting the runtime Add User form with an untouched
    // Image Upload field 500'd until this branch was added.
    else if (reg.fieldType === 'file') out[el.key] = null
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
    // 'file' excluded for the same reason as 'reference'/'json'/'boolean':
    // its physical column is JSONB, and schema-to-zod's file case is
    // `.nullable()` — a loaded record's unset file field is a real SQL NULL
    // and must stay null, not get coerced to '' (which 500s as invalid JSON
    // on the next save).
    if (!reg.dataBearing || reg.fieldType === 'json' || reg.fieldType === 'boolean' || reg.fieldType === 'reference' || reg.fieldType === 'file') continue
    if (out[el.key] === null) out[el.key] = ''
  }
  return out
}

/** Stable identity for "nothing hidden", so the validator memo below doesn't
 *  rebuild on every render of a form with no Advanced Settings at all. */
const EMPTY_KEYS: ReadonlySet<string> = new Set<string>()

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
  const variables = schemaToVariableDecls(schema)

  // Fields an Advanced Setting hides from THIS viewer, fed back into the
  // validator so a hidden `required: always` field can't make the form
  // permanently unsubmittable for a whole role.
  //
  // State rather than a value derived inline, because the dependency is
  // circular: the rules resolve against live form values, which come from the
  // form, which needs the validator. Kept as state and synced one render
  // later, which is harmless — validation only runs on change or submit, long
  // after the first paint. react-hook-form v7 re-reads control._options on
  // every render, so the newer resolver is the one that actually runs.
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS)
  const zodSchema = useMemo(() => buildZodSchema(schema, hiddenKeys), [schema, hiddenKeys])

  // Field states asserted by a field-change workflow's set_field_state steps.
  // A THIRD layer on top of the behavior rules and Advanced Settings rather
  // than a replacement for either: only the keys a step actually set are
  // present, and they win, because a step asserting something is a more
  // specific instruction than a standing rule. Nothing clears them — an
  // assertion holds for the rest of this fill, which is what makes "reveal a
  // section once they pick Other" behave the way an author expects.
  //
  // Declared up here, beside hiddenKeys, because the validator sync below
  // reads both.
  const [workflowFieldStates, setWorkflowFieldStates] = useState<Record<string, FieldStatePatch>>({})

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
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

  // Advanced Settings (per-element hide / read-only / clear rules). Resolved
  // here rather than inside the element map so the clear_value effect below
  // has the whole picture, and so the viewer is read exactly once — the same
  // reason useTabVisible splits useCurrentViewer from its pure per-item check.
  //
  // Unlike the expression rules above, these need no round-trip: an Advanced
  // Setting's condition tree is client-evaluable by construction (see
  // advanced-settings.ts), so it resolves synchronously from live values.
  const viewer = useCurrentViewer()
  const advancedEffects = useMemo(() => {
    const out: Record<string, AdvancedFieldEffects> = {}
    for (const el of iterElements(schema)) {
      if (!el.advancedSettings?.length) continue
      out[el.key] = resolveAdvancedSettings(el.advancedSettings, viewer, liveValues ?? {})
    }
    return out
  }, [schema, viewer, liveValues])

  // Sync the hidden set used by the validator above. Compared by content, not
  // identity — a fresh Set every render would loop forever.
  //
  // Covers BOTH ways a field can end up off screen: an Advanced Setting rule
  // and a workflow step's assertion. Either one hiding a `required: always`
  // field would otherwise make the form unsubmittable with the error pinned to
  // a control nobody can see.
  useEffect(() => {
    const next = new Set(
      Object.entries(advancedEffects).filter(([, e]) => e.hidden).map(([key]) => key),
    )
    for (const [key, patch] of Object.entries(workflowFieldStates)) {
      if (patch.visible === false) next.add(key)
      // An assertion of visible:true also OVERRIDES a rule-driven hide, so the
      // field is back on screen and its requirement applies again.
      if (patch.visible === true) next.delete(key)
    }
    setHiddenKeys((prev) =>
      prev.size === next.size && [...next].every((k) => prev.has(k)) ? prev : next,
    )
  }, [advancedEffects, workflowFieldStates])

  // The form-aware half of the host. Only these two methods exist here; a
  // navigate or a record write goes through the shared host the hook builds.
  const formHost = useUiWorkflowHost({
    onRefresh: () => {},
    formCapabilities: {
      setFieldValue: (key, value) => setValue(key, value, { shouldDirty: true, shouldValidate: true }),
      setFieldState: (key, patch) =>
        setWorkflowFieldStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } })),
    },
  })

  useFieldChangeWorkflow({
    config: schema.settings?.fieldChangeWorkflow,
    values: liveValues ?? {},
    host: formHost,
    formId,
  })

  // clear_value is the one action that writes rather than renders. Guarded on
  // the value not already being empty so this can't ping-pong: clearing feeds
  // back into liveValues, which re-runs the rules above.
  useEffect(() => {
    for (const [key, effects] of Object.entries(advancedEffects)) {
      if (!effects.clearValue) continue
      const current = (liveValues ?? {})[key]
      if (current === '' || current === null || current === undefined) continue
      if (Array.isArray(current) && current.length === 0) continue
      setValue(key, Array.isArray(current) ? [] : '', { shouldDirty: true, shouldValidate: true })
    }
  }, [advancedEffects, liveValues, setValue])

  const chromeSections = shouldChromeSections(schema.sections.length)

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(values))} className={chromeSections ? 'space-y-4' : 'space-y-6'}>
      {schema.sections.map((section) => (
        <FormSectionShell
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
          chrome={chromeSections}
        >
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

                    // Advanced Settings compose ON TOP of the behavior rules
                    // rather than replacing them: both are restrictions, so
                    // either one asserting hidden/read-only wins.
                    const advanced = advancedEffects[el.key] ?? NO_EFFECTS
                    // A workflow step's assertion is the most specific
                    // instruction of the three, so it wins where it spoke;
                    // where it said nothing, the standing rules still decide.
                    const asserted = workflowFieldStates[el.key]
                    const visible = asserted?.visible ?? (runtimeState.visible && !advanced.hidden)
                    // A field nobody can see must not also block submit as
                    // required — the filler would face a validation error
                    // pointing at a field that isn't on screen.
                    const required = (asserted?.required ?? resolvedRequired) && visible
                    const readOnly = asserted?.readOnly ?? (resolvedReadOnly || advanced.readOnly)

                    return (
                      <FieldRenderer
                        key={el.id}
                        element={el}
                        control={control}
                        formId={formId}
                        runtimeState={{ visible, required, readOnly }}
                        error={errors[el.key]?.message as string | undefined}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </FormSectionShell>
      ))}

      <Button type="submit" disabled={submitting} className="gap-1.5">
        {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
        {submitLabel ?? 'Submit'}
      </Button>
    </form>
  )
}
