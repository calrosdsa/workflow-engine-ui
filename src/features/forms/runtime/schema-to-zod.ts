import { z } from 'zod'
import { iterElements } from '@/features/form-builder/projection'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import type { FormSchema, FormElement } from '@/features/form-builder/schema'

/** Component types with a simple, self-contained FieldInput control that
 *  makes sense rendered/written to standalone, outside a whole-form context.
 *  Deliberately excludes: 'form' (needs ReferenceFieldAutocomplete's own
 *  search popover — a real candidate, but separate, follow-up scope),
 *  'line_items' (a whole grid, never single-field-writable), 'line_item_count'
 *  (virtual/computed, never a real input), 'file'/'image' (FileFieldInput
 *  needs a real file picker + upload flow, not a bare value input — a
 *  standalone single-field editor/update_field target for these would need
 *  its own upload UI, not just a value write; separate, follow-up scope,
 *  same reasoning as 'form' above), and every presentational type (no value
 *  to write). */
const SINGLE_FIELD_WRITABLE_TYPES = new Set<FormElement['component']>([
  'text', 'textarea', 'richtext', 'number', 'email', 'url', 'password', 'phone',
  'date', 'time', 'datetime',
  'checkbox', 'switch', 'radio', 'select', 'multiselect', 'role', 'autocomplete',
])

/** True when `el` is a legal target for a standalone single-field write
 *  (per-field inline editing, or a FR-D2-017 update_field custom action) —
 *  the STATIC half of eligibility, shared by both call sites. Deliberately
 *  does NOT check any runtime permission (a caller-specific concern,
 *  InlineFieldEditor.tsx's own `canEdit` gate is not meaningful at Form
 *  Builder config time, where there is no "current viewer" to check against)
 *  and deliberately excludes expression-mode readOnly/visibility (would need
 *  the same whole-form useExpressionRuntimeState round-trip FormRenderer
 *  runs — out of scope for a single isolated field; excluding rather than
 *  guessing keeps this safe, since a field that SHOULD be blocked by an
 *  expression never becomes writable this way, it just stays unavailable). */
export function isFieldSingleWritable(el: FormElement): boolean {
  if (!SINGLE_FIELD_WRITABLE_TYPES.has(el.component)) return false
  if (el.behavior.readOnly === 'always') return false
  if (el.behavior.visibility === 'hidden') return false
  if (el.behavior.readOnly === 'expression') return false
  if (el.behavior.visibility === 'expression') return false
  // Advanced Settings can hide or lock this field for the current viewer, and
  // resolving that needs a viewer this function deliberately has no access to
  // (see the doc comment above). Excluded for exactly the same reason as the
  // expression modes: staying unavailable is safe, guessing writable is not.
  if (el.advancedSettings?.length) return false
  return true
}

/** Builds a per-field zod validator from a data-bearing element's validation
 *  rules and static (non-expression) required mode. Expression-mode required
 *  fields cannot be statically encoded here — see expression-context.ts's
 *  superRefine-based runtime check, applied by FormRenderer on top of this
 *  schema's result. Exported for InlineFieldEditor.tsx's single-field
 *  validation on the record detail view — a field with expression-mode
 *  required/readOnly/visibility is excluded from inline editing entirely
 *  (see that file), so this static-rules-only validator is a complete,
 *  correct check for every field inline editing actually allows. */
export function fieldSchema(el: FormElement, relaxRequired = false): z.ZodTypeAny {
  const reg = COMPONENT_REGISTRY[el.component]
  // relaxRequired drops the static requirement for a field the viewer cannot
  // currently see — an Advanced Setting can hide a `required: always` field
  // from a whole role, and without this the form becomes unsubmittable for
  // them with the validation error pinned to a field that isn't on screen.
  const isStaticRequired = el.behavior.required === 'always' && !relaxRequired

  let base: z.ZodTypeAny
  switch (reg.fieldType) {
    case 'integer':
    case 'decimal': {
      let num = z.coerce.number()
      if (el.validation.min !== undefined) num = num.min(el.validation.min, el.validation.customMessage)
      if (el.validation.max !== undefined) num = num.max(el.validation.max, el.validation.customMessage)
      base = num
      break
    }
    case 'boolean':
      base = z.boolean()
      break
    case 'json':
      base = z.any()
      break
    case 'file': {
      // FileFieldValue shape (see internal/forms/field's TypeFile doc
      // comment and features/content/types.ts) — an object, not a string,
      // so it must NOT fall into the default string-based case below (that
      // would reject every real upload at validation time). null covers the
      // unset/cleared state (FileFieldInput's "Remove" writes null).
      const maxFileSizeBytes = el.validation.maxFileSizeBytes
      const allowedMimeTypes = el.validation.allowedMimeTypes
      // Same MaxFileSizeBytes/AllowedMimeTypes rule as the backend
      // (internal/forms/validator's TypeFile case, FR-C1-012) — a redundant,
      // frontend-only re-check of the SAVED record's value, not the upload
      // itself (FileFieldInput's own preflightCheck + the backend's Upload
      // handler are what actually stop a bad file from being stored; this
      // exists only so a record edited to reference a since-changed-rule
      // value, or a record loaded from before a rule was tightened, is still
      // caught at save time rather than silently passing this form's own
      // validation).
      base = z.object({
        content_id: z.string(),
        filename: z.string(),
        content_type: z.string(),
        size_bytes: z.number(),
      })
        .superRefine((v, ctx) => {
          if (maxFileSizeBytes !== undefined && v.size_bytes > maxFileSizeBytes) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: el.validation.customMessage ?? 'File exceeds the maximum allowed size.' })
          }
          if (allowedMimeTypes?.length && !allowedMimeTypes.includes(v.content_type)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: el.validation.customMessage ?? 'File type is not allowed.' })
          }
        })
        .nullable()
      break
    }
    default: {
      let str = z.string()
      if (el.validation.minLength !== undefined) str = str.min(el.validation.minLength, el.validation.customMessage)
      if (el.validation.maxLength !== undefined) str = str.max(el.validation.maxLength, el.validation.customMessage)
      if (el.validation.pattern) {
        try {
          str = str.regex(new RegExp(el.validation.pattern), el.validation.customMessage)
        } catch {
          // invalid regex authored in the builder — skip rather than crash the renderer
        }
      }
      base = str
      break
    }
  }

  if (!isStaticRequired) {
    // A reference field's unset state is a real SQL NULL on a uuid FK column
    // (see FormRenderer.tsx's nullsToEmptyStrings, which deliberately leaves
    // reference values alone rather than coercing them to '' like every
    // other string-shaped field) — '' isn't a valid uuid and 500s at the DB
    // layer, so null has to be an accepted value here too, not just ''.
    // 'file' is the same shape of exception, for the same reason: its unset
    // state is JSONB null (FileFieldInput's "Remove" writes null), and '' is
    // not a valid FileFieldValue object either.
    const nullableTypes = reg.fieldType === 'reference' || reg.fieldType === 'file'
    base = nullableTypes ? base.optional().nullable().or(z.literal('')) : base.optional().or(z.literal(''))
  }
  return base
}

/** Builds a zod object schema from a form's builder schema, keyed by each
 *  data-bearing element's `key` (matching the record shape the backend
 *  expects). Presentational elements (heading/paragraph/divider/spacer) are
 *  skipped — they carry no value. */
export function buildZodSchema(
  schema: FormSchema,
  /** Field keys whose static `required` rule should not apply, because the
   *  viewer can't see them (FormRenderer passes the fields an Advanced
   *  Setting has hidden). Omitted everywhere else, so existing callers keep
   *  the full static rules. */
  relaxRequiredKeys?: ReadonlySet<string>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const el of iterElements(schema)) {
    if (el.component === 'line_items') {
      // Not dataBearing (it's a nested child-record array, not a single
      // FieldDef column) but it DOES carry a real value that must reach
      // onSubmit — without an explicit shape entry, zodResolver's z.object()
      // silently strips it as an unrecognized key, so every line-items save
      // would submit an empty array regardless of what the grid held.
      shape[el.key] = z.array(z.record(z.string(), z.unknown()))
      continue
    }
    if (!COMPONENT_REGISTRY[el.component].dataBearing) continue
    shape[el.key] = fieldSchema(el, relaxRequiredKeys?.has(el.key) ?? false)
  }
  return z.object(shape)
}
