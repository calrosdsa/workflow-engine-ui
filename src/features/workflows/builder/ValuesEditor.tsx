// Field-value list editor, shared by the Upsert and Update record nodes.
//
// Renders a flat list of {field, value|expression} rows — the write-side
// counterpart to FilterBuilder's condition rows, minus the combinator/operator
// (a value write always means "set field = value").
//
// Each row is one inline strip: field selector, a compact Value/Expression
// toggle, then the value input — instead of three stacked blocks. In "Value"
// mode, the input adapts to the selected field's type: a reference field gets
// a searchable record combobox (RecordReferencePicker), an enum field gets a
// plain <select> of its declared values, and everything else keeps the
// original free-text input.

import { useState } from 'react'
import { Plus, Trash2, Code2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { RecordReferencePicker } from './RecordReferencePicker'
import { nanoid } from './nanoid'
import type { NodeOutputSchema } from './node-output-schema'
import type { FieldDef } from '@/features/forms/types'
import type { VariableDecl, FieldValue } from '../types'

export function newFieldValue(): FieldValue {
  return { id: nanoid(), field: '', value_mode: 'static', value: '', expression: '' }
}

interface ValuesEditorProps {
  values: FieldValue[]
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext?: NodeOutputSchema[]
  onChange: (values: FieldValue[]) => void
}

export function ValuesEditor({ values, fields, variables, nodeContext = [], onChange }: ValuesEditorProps) {
  const addValue = () => onChange([...values, newFieldValue()])
  const updateValue = (id: string, patch: Partial<FieldValue>) =>
    onChange(values.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  const removeValue = (id: string) => onChange(values.filter((v) => v.id !== id))

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-2.5">
      {values.length === 0 && (
        <p className="px-1 py-2 text-center text-[11px] text-slate-400">No field values yet.</p>
      )}

      <div className="space-y-1.5">
        {values.map((v) => (
          <ValueRow
            key={v.id}
            value={v}
            fields={fields}
            variables={variables}
            nodeContext={nodeContext}
            onChange={(patch) => updateValue(v.id, patch)}
            onRemove={() => removeValue(v.id)}
          />
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addValue} className="mt-2 h-7 w-full gap-1 border-dashed text-[11px] text-slate-500">
        <Plus size={12} /> Field value
      </Button>
    </div>
  )
}

function ValueRow({ value, fields, variables, nodeContext, onChange, onRemove }: {
  value: FieldValue
  fields: FieldDef[]
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (patch: Partial<FieldValue>) => void
  onRemove: () => void
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const isExpr = value.value_mode === 'expression'
  const selectedField = fields.find((f) => f.name === value.field)

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5">
      <select
        value={value.field}
        onChange={(e) => onChange({ field: e.target.value })}
        className="w-28 shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
      >
        <option value="">field…</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>{f.label || f.name}</option>
        ))}
      </select>

      <div className="flex shrink-0 gap-0.5 rounded-md bg-slate-100 p-0.5">
        {(['static', 'expression'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ value_mode: m })}
            title={m === 'static' ? 'Value' : 'Expression'}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              (value.value_mode ?? 'static') === m ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400',
            )}
          >
            {m === 'static' ? 'Value' : 'Expr'}
          </button>
        ))}
      </div>

      {isExpr ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <input
            value={value.expression ?? ''}
            onChange={(e) => onChange({ expression: e.target.value })}
            placeholder='Vars["name"]'
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:outline-none"
          />
          <button
            onClick={() => setEditorOpen(true)}
            title="Open expression editor"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600"
          >
            <Code2 size={12} />
          </button>
        </div>
      ) : selectedField?.type === 'reference' ? (
        <RecordReferencePicker
          field={selectedField}
          value={value.value == null ? '' : String(value.value)}
          onChange={(id) => onChange({ value: id ?? '' })}
        />
      ) : selectedField?.type === 'enum' && selectedField.enum_values?.length ? (
        <select
          value={value.value == null ? '' : String(value.value)}
          onChange={(e) => onChange({ value: e.target.value })}
          className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700 focus:border-indigo-400 focus:outline-none"
        >
          <option value="">select…</option>
          {selectedField.enum_values.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : (
        <Input
          value={value.value == null ? '' : String(value.value)}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="value…"
          className="h-7 min-w-0 flex-1 text-[12px]"
        />
      )}

      <button
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400"
        title="Remove value"
      >
        <Trash2 size={11} />
      </button>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={value.expression ?? ''}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label={value.field || 'field value'}
      />
    </div>
  )
}
