// The update_field custom action's actual dispatch (FR-D2-017 §3/§4) — on
// click, resolves the configured value (static, or expression-evaluated via
// the same /expressions/validate backend evaluator renderIf/visibleWhen
// already use, just consumed here for its VALUE instead of its boolean
// visibility use), validates it against the same per-field Zod schema
// per-field inline editing already uses (fieldSchema), then writes it via
// useUpdateRecord — the exact single-key partial-PATCH shape InlineFieldEditor
// already makes, landing on the backend's existing partial-UPDATE/Line-Items-
// safe path. Failure/success surfaced via the same sonner toast convention
// RecordDetailToolbar's own Delete/account actions and per-field inline
// editing already use — not a new UI treatment, a reuse of the one already
// shipping (FR-D2-017 §8, correcting an earlier draft's assumption that no
// such precedent existed).
import { useState } from 'react'
import { toast } from 'sonner'
import { validateExpression } from '@/lib/api'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useUpdateRecord } from '@/features/forms/hooks'
import { fieldSchema } from '@/features/forms/runtime/schema-to-zod'
import { schemaToVariableDecls } from '@/features/forms/runtime/expression-context'
import { iterElements } from '@/features/form-builder/projection'
import type { CustomActionMenuItemProps } from '../contract'
import type { UpdateFieldActionConfig } from './schema'

export function UpdateFieldMenuItem({ formId, recordId, record, schema, config, label, onDone }: CustomActionMenuItemProps<UpdateFieldActionConfig>) {
  const [pending, setPending] = useState(false)
  const updateRecord = useUpdateRecord(formId)
  const targetField = schema ? Array.from(iterElements(schema)).find((el) => el.key === config.fieldKey) : undefined

  // A stale target (deleted/renamed field since this action was configured,
  // FR-D2-017 §6's first edge-case row) — omit the menu item entirely rather
  // than attempt a write against a field key that no longer resolves,
  // mirroring FR-D2-015's identical "stale reference → omit" convention for
  // a related_form tab whose targetFormId was deleted.
  if (!targetField || !config.fieldKey) return null

  const run = async () => {
    if (pending) return
    setPending(true)
    try {
      let rawValue: unknown = config.staticValue
      if (config.valueMode === 'expression') {
        if (!config.expressionValue) {
          toast.error('Save failed', { description: 'This action has no expression configured.' })
          return
        }
        const variables = schema ? schemaToVariableDecls(schema) : []
        const result = await validateExpression({
          expression: config.expressionValue,
          variables,
          evaluate: true,
          sample_values: record,
        })
        if (!result.valid) {
          toast.error('Save failed', { description: result.error ?? 'Could not evaluate the configured expression.' })
          return
        }
        rawValue = result.preview?.value
      }

      const parsed = fieldSchema(targetField).safeParse(rawValue)
      if (!parsed.success) {
        toast.error('Save failed', { description: parsed.error.issues[0]?.message || 'Invalid value' })
        return
      }

      await updateRecord.mutateAsync({ recordId, data: { [config.fieldKey]: parsed.data } })
      toast.success('Saved', { description: `${targetField.label} was updated.` })
      onDone?.()
    } catch (e) {
      toast.error('Save failed', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenuItem disabled={pending} onClick={run}>
      {label}
    </DropdownMenuItem>
  )
}
