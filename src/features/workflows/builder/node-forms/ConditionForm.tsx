import { useState } from 'react'
import { Braces, Code2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { ExpressionEditor } from '../ExpressionEditor'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, ConditionConfig } from '../../types'

// condition — no normalisation needed; the config shape has been stable
// since the DAG redesign and is safe to cast directly.
export function normaliseConditionConfig(raw: unknown): ConditionConfig {
  return raw as ConditionConfig
}

export interface ConditionFormProps {
  config: ConditionConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: ConditionConfig) => void
}

export function ConditionForm({ config, variables, nodeContext, onChange }: ConditionFormProps) {
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Condition Expression
        </Label>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-indigo-500 hover:bg-indigo-50 transition-colors"
        >
          <Code2 size={11} />
          Editor
        </button>
      </div>

      <div className="relative">
        <Braces size={11} className="absolute left-2.5 top-2.5 text-indigo-400" />
        <textarea
          value={config.expression}
          onChange={(e) => onChange({ expression: e.target.value })}
          rows={3}
          placeholder={`e.g. Vars["age"] >= 18`}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {variables.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Available variables</p>
          <div className="flex flex-wrap gap-1">
            {variables.map((v) => (
              <button
                key={v.name}
                onClick={() => onChange({ expression: config.expression + `Vars["${v.name}"]` })}
                className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                title={`Insert Vars["${v.name}"]`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Must return a boolean. Routes to <span className="font-semibold text-emerald-600">true</span> or <span className="font-semibold text-rose-500">false</span> output.
      </p>

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value={config.expression}
        onChange={(expr) => onChange({ expression: expr })}
        variables={variables}
        nodeContext={nodeContext}
        label="condition"
      />
    </div>
  )
}
