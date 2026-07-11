import { z } from 'zod'
import { iterElements } from '@/features/form-builder/projection'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import type { FormSchema, FormElement } from '@/features/form-builder/schema'

/** Builds a per-field zod validator from a data-bearing element's validation
 *  rules and static (non-expression) required mode. Expression-mode required
 *  fields cannot be statically encoded here — see expression-context.ts's
 *  superRefine-based runtime check, applied by FormRenderer on top of this
 *  schema's result. */
function fieldSchema(el: FormElement): z.ZodTypeAny {
  const reg = COMPONENT_REGISTRY[el.component]
  const isStaticRequired = el.behavior.required === 'always'

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
    base = base.optional().or(z.literal(''))
  }
  return base
}

/** Builds a zod object schema from a form's builder schema, keyed by each
 *  data-bearing element's `key` (matching the record shape the backend
 *  expects). Presentational elements (heading/paragraph/divider/spacer) are
 *  skipped — they carry no value. */
export function buildZodSchema(schema: FormSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const el of iterElements(schema)) {
    if (!COMPONENT_REGISTRY[el.component].dataBearing) continue
    shape[el.key] = fieldSchema(el)
  }
  return z.object(shape)
}
