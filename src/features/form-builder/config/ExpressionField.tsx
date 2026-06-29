import { useState } from 'react'
import { Code2, Braces } from 'lucide-react'
import { ExpressionEditor } from '@/features/workflows/builder/ExpressionEditor'
import type { NodeOutputSchema } from '@/features/workflows/builder/node-output-schema'
import { cn } from '@/lib/utils'
import type { VariableDecl } from '@/features/workflows/types'

interface ExpressionFieldProps {
  value: string
  onChange: (v: string) => void
  variables: VariableDecl[]
  /** Upstream node outputs, when used inside a workflow node context. */
  nodeContext?: NodeOutputSchema[]
  placeholder?: string
  label?: string
}

/** A single-line expression input with a button to open the full editor.
 *  Reuses the workflow ExpressionEditor (autocomplete, validation, preview). */
export function ExpressionField({ value, onChange, variables, nodeContext, placeholder, label }: ExpressionFieldProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <Braces size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'e.g. Vars["country"] == "US"'}
          className={cn(
            'w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 font-mono text-[11px] text-slate-700',
            'placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100',
          )}
        />
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open expression editor"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Code2 size={13} />
      </button>
      <ExpressionEditor
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={onChange}
        variables={variables}
        nodeContext={nodeContext}
        label={label}
      />
    </div>
  )
}
