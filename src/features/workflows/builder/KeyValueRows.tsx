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
import { useI18n } from '@/features/i18n/I18nProvider'
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
  const { t } = useI18n()
  const addRow = () => onChange([...rows, newKeyValuePair()])
  const updateRow = (id: string, patch: Partial<KeyValuePair>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-2.5">
      {rows.length === 0 && (
        <p className="px-1 py-2 text-center text-[11px] text-[hsl(var(--muted-foreground))]">{t('workflows.builder.no_rows')}</p>
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

      <Button variant="outline" size="sm" onClick={addRow} className="mt-2 h-7 w-full gap-1 border-dashed text-[11px] text-[hsl(var(--muted-foreground))]">
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
  const { t } = useI18n()
  const isExpr = row.value_mode === 'expression'

  return (
    <div className={cn('rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2', !row.enabled && 'opacity-50')}>
      <div className="flex items-center gap-1.5">
        <Checkbox
          checked={row.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked === true })}
          title={row.enabled ? t('workflows.builder.disable_row') : t('workflows.builder.enable_row')}
        />
        <Input
          value={row.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder={keyPlaceholder}
          className="h-7 min-w-0 flex-1 font-mono text-[11px]"
        />
        <button
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
          title={t('workflows.builder.remove_row')}
        >
          <Trash2 size={11} />
        </button>
      </div>

      <div className="mt-1.5 space-y-1.5">
        <div className="flex gap-1 rounded-md bg-[hsl(var(--muted))] p-0.5">
          {(['static', 'expression'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ value_mode: m })}
              className={cn(
                'flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1',
                (row.value_mode ?? 'static') === m ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]',
              )}
            >
              {m === 'static' ? t('common.value') : t('workflows.node_forms.expression')}
            </button>
          ))}
        </div>

        {isExpr ? (
          <div className="flex items-center gap-1.5">
            <input
              value={row.expression ?? ''}
              onChange={(e) => onChange({ expression: e.target.value })}
              placeholder='Vars["name"]'
              className="min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 font-mono text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
            <button
              onClick={() => setEditorOpen(true)}
              title={t('workflows.builder.open_expression')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
            >
              <Code2 size={12} />
            </button>
          </div>
        ) : (
          <Input
            value={row.value == null ? '' : String(row.value)}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={t('workflows.builder.value_placeholder')}
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
