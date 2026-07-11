// Generalized sibling of ValuesEditor.tsx for the HTTP Request node's
// Params/Headers/Form-body tabs: a flat list of {key, enabled, value|expression}
// rows (Postman-style). Differs from ValuesEditor in two ways: the key is a
// free-text input rather than a form-field select (headers/params aren't form
// fields), and each row has an Enabled checkbox so a row can be kept but not
// sent, without deleting it.

import { useState } from 'react'
import { Plus, Trash2, Code2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ExpressionEditor } from './ExpressionEditor'
import { nanoid } from './nanoid'
import type { NodeOutputSchema } from './node-output-schema'
import type { VariableDecl, KeyValuePair } from '../types'

export function newKeyValuePair(): KeyValuePair {
  return { id: nanoid(), key: '', enabled: true, value_mode: 'static', value: '', expression: '' }
}

interface KeyValueRowsProps {
  rows: KeyValuePair[]
  variables: VariableDecl[]
  nodeContext?: NodeOutputSchema[]
  onChange: (rows: KeyValuePair[]) => void
  keyPlaceholder?: string
  addLabel?: string
}

export function KeyValueRows({
  rows, variables, nodeContext = [], onChange,
  keyPlaceholder = 'key', addLabel = 'Add row',
}: KeyValueRowsProps) {
  const addRow = () => onChange([...rows, newKeyValuePair()])
  const updateRow = (id: string, patch: Partial<KeyValuePair>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-2.5">
      {rows.length === 0 && (
        <p className="px-1 py-2 text-center text-[11px] text-slate-400">No rows yet.</p>
      )}

      <div className="space-y-1.5">
        {rows.map((r) => (
          <KeyValueRow
            key={r.id}
            row={r}
            variables={variables}
            nodeContext={nodeContext}
            keyPlaceholder={keyPlaceholder}
            onChange={(patch) => updateRow(r.id, patch)}
            onRemove={() => removeRow(r.id)}
          />
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="mt-2 h-7 w-full gap-1 border-dashed text-[11px] text-slate-500">
        <Plus size={12} /> {addLabel}
      </Button>
    </div>
  )
}

function KeyValueRow({ row, variables, nodeContext, keyPlaceholder, onChange, onRemove }: {
  row: KeyValuePair
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  keyPlaceholder: string
  onChange: (patch: Partial<KeyValuePair>) => void
  onRemove: () => void
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const isExpr = row.value_mode === 'expression'

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-2', !row.enabled && 'opacity-50')}>
      <div className="flex items-center gap-1.5">
        <Checkbox
          checked={row.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked === true })}
          title={row.enabled ? 'Disable this row' : 'Enable this row'}
        />
        <Input
          value={row.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder={keyPlaceholder}
          className="h-7 min-w-0 flex-1 font-mono text-[11px]"
        />
        <button
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-400"
          title="Remove row"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <div className="mt-1.5 space-y-1.5">
        <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
          {(['static', 'expression'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ value_mode: m })}
              className={cn(
                'flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                (row.value_mode ?? 'static') === m ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400',
              )}
            >
              {m === 'static' ? 'Value' : 'Expression'}
            </button>
          ))}
        </div>

        {isExpr ? (
          <div className="flex items-center gap-1.5">
            <input
              value={row.expression ?? ''}
              onChange={(e) => onChange({ expression: e.target.value })}
              placeholder='Vars["name"]'
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:outline-none"
            />
            <button
              onClick={() => setEditorOpen(true)}
              title="Open expression editor"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-slate-600"
            >
              <Code2 size={12} />
            </button>
          </div>
        ) : (
          <Input
            value={row.value == null ? '' : String(row.value)}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="value…"
            className="h-7 text-[12px]"
          />
        )}
      </div>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={row.expression ?? ''}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label={row.key || 'value'}
      />
    </div>
  )
}
