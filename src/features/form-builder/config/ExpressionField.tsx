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
        <Braces size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))]/60" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'e.g. Vars["country"] == "US"'}
          className={cn(
            'w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1.5 pl-7 pr-2 font-mono text-[11px] text-[hsl(var(--foreground))]',
            'placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--ring))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15',
          )}
        />
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open expression editor"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 hover:text-[hsl(var(--primary))]"
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
