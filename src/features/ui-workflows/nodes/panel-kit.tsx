// Small shared bits for node config panels.
//
// A local copy of the form-builder's `Field` rather than an import from
// config/ConfigPanel.tsx: that module pulls in the whole form-builder store,
// the detail-page overlay and the component registry, none of which a node
// panel needs — and importing it here would drag all of it into the runtime
// bundle just to draw a label.
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import type { FieldDef } from '@/features/forms/types'

export function Field({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>}
    </div>
  )
}

/** The value-source picker several nodes share: a literal, a run variable, or
 *  a field off the record in context. Deliberately no expression option —
 *  Expr has no client evaluator, so an expression would cost a round-trip per
 *  value, which is the same reason conditions are structured trees. */
export const VALUE_SOURCE_HINT =
  'A typed-in value, a variable an earlier step set, or a field on the record this workflow is acting on.'

/** Picks one of the attached form's fields.
 *
 *  Falls back to a free-text input when the surface has no field list —
 *  the record-action panel knows its form, but a workflow authored against a
 *  form that failed to load should still be editable rather than presenting
 *  an empty dropdown with no way out. */
export function FieldPicker({ fields, value, onChange }: {
  fields: FieldDef[]
  value: string
  onChange: (next: string) => void
}) {
  if (fields.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="field_name"
        className="h-8 font-mono text-[11px]"
      />
    )
  }
  return (
    <SelectMenu value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Pick a field…" /></SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name} className="text-[12px]">
            {f.label || f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}
