import { useEffect, useRef, useState } from 'react'
import { validateExpression } from '@/lib/api'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import { iterElements } from '@/features/form-builder/projection'
import type { FormSchema } from '@/features/form-builder/schema'
import type { VariableDecl } from '@/features/workflows/types'
import type { FieldType } from '@/features/forms/types'

export type FieldRuntimeState = {
  visible: boolean
  required: boolean
  readOnly: boolean
}

const DEFAULT_STATE: FieldRuntimeState = { visible: true, required: false, readOnly: false }

// Form-builder expressions (visibleWhen/requiredWhen/readOnlyWhen) are
// authored against Vars["fieldKey"] — the SAME `Vars["..."]` addressing
// workflow expressions use (see ExpressionField.tsx's placeholder), since
// forms have no variable-declaration mechanism of their own. The backend's
// /expressions/validate endpoint only synthesises env.Vars from DECLARED
// VariableDecl[] (buildSampleVars iterates decls, not sample_values), so a
// live field's current value only reaches the expression if this call also
// declares that field as a variable — passing sample_values alone is
// silently ignored.
const FIELD_TYPE_TO_VAR_TYPE: Partial<Record<FieldType, VariableDecl['type']>> = {
  integer: 'integer',
  decimal: 'float',
  boolean: 'boolean',
  date: 'datetime',
  datetime: 'datetime',
  time: 'datetime',
}

/** Declares every data-bearing field in the schema as a VariableDecl, so the
 *  backend evaluator has something to resolve Vars["key"] against. */
export function schemaToVariableDecls(schema: FormSchema): VariableDecl[] {
  const decls: VariableDecl[] = []
  for (const el of iterElements(schema)) {
    const reg = COMPONENT_REGISTRY[el.component]
    if (!reg.dataBearing || !reg.fieldType) continue
    decls.push({ name: el.key, type: FIELD_TYPE_TO_VAR_TYPE[reg.fieldType] ?? 'string' })
  }
  return decls
}

/** Resolves visibility/required/readOnly expressions against the form's live
 *  values by calling the backend's own Expr evaluator (the SAME endpoint and
 *  semantics the builder's ExpressionEditor preview already uses), rather
 *  than a client-side Expr interpreter (which doesn't exist). This
 *  guarantees runtime behavior never drifts from what the admin validated at
 *  design time, at the cost of a network round-trip per dependent-field
 *  change — acceptable given typical form field counts. Debounced and
 *  cached per (expression, values) pair so rapid typing doesn't spam the
 *  endpoint. */
export function useExpressionRuntimeState(
  expressions: { key: string; kind: 'visibleWhen' | 'requiredWhen' | 'readOnlyWhen'; expr: string | undefined }[],
  variables: VariableDecl[],
  values: Record<string, unknown>,
): Record<string, FieldRuntimeState> {
  const [resolved, setResolved] = useState<Record<string, FieldRuntimeState>>({})
  const cacheRef = useRef<Map<string, boolean>>(new Map())

  useEffect(() => {
    const active = expressions.filter((e) => !!e.expr)
    if (active.length === 0) return

    const valuesKey = JSON.stringify(values)
    const timer = setTimeout(async () => {
      const next: Record<string, FieldRuntimeState> = {}
      await Promise.all(
        active.map(async ({ key, kind, expr }) => {
          const cacheKey = `${expr}::${valuesKey}`
          let truthy = cacheRef.current.get(cacheKey)
          if (truthy === undefined) {
            try {
              const result = await validateExpression({
                expression: expr!,
                variables,
                evaluate: true,
                sample_values: values,
              })
              truthy = result.valid && !!result.preview?.value
            } catch {
              truthy = false
            }
            cacheRef.current.set(cacheKey, truthy)
          }
          const base = next[key] ?? DEFAULT_STATE
          if (kind === 'visibleWhen') next[key] = { ...base, visible: truthy }
          if (kind === 'requiredWhen') next[key] = { ...base, required: truthy }
          if (kind === 'readOnlyWhen') next[key] = { ...base, readOnly: truthy }
        }),
      )
      setResolved((prev) => ({ ...prev, ...next }))
    }, 250)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(expressions), JSON.stringify(variables), JSON.stringify(values)])

  return resolved
}

export function getFieldRuntimeState(
  resolved: Record<string, FieldRuntimeState>,
  key: string,
): FieldRuntimeState {
  return resolved[key] ?? DEFAULT_STATE
}
