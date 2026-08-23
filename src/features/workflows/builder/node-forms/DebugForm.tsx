// debug — mirrors internal/graph/configs_debug.go
import { useState } from 'react'
import { Plus, Trash2, Braces, Code2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ExpressionEditor } from '../ExpressionEditor'
import { nanoid } from '../nanoid'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, DebugConfig, DebugWatch } from '../../types'

// debug — normalises the legacy shape (label only, no watches) forward;
// re-attaches a local id to any watch missing one, same convention every
// other list-of-rows config in this builder uses (e.g. SetVariableConfig's
// assignments, FetchRecordsConfig's sort rules).
export function normaliseDebugConfig(raw: unknown): DebugConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DebugConfig>
  const watches = Array.isArray(r.watches)
    ? r.watches.map((w) => ({ id: (w as Partial<DebugWatch>).id || nanoid(), name: w.name ?? '', expression: w.expression ?? '' }))
    : []
  return { label: r.label ?? '', watches }
}

export interface DebugFormProps {
  config: DebugConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: DebugConfig) => void
}

export function DebugForm({ config, variables, nodeContext, onChange }: DebugFormProps) {
  const [editorOpen, setEditorOpen] = useState<string | null>(null) // watch id

  const watches = config.watches ?? []

  const update = (id: string, patch: Partial<DebugWatch>) => {
    onChange({ ...config, watches: watches.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
  }

  const add = () => {
    onChange({ ...config, watches: [...watches, { id: nanoid(), name: '', expression: '' }] })
  }

  const remove = (id: string) => {
    onChange({ ...config, watches: watches.filter((w) => w.id !== id) })
  }

  const openingWatch = editorOpen ? watches.find((w) => w.id === editorOpen) : null

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Label (optional)</Label>
        <Input
          value={config.label ?? ''}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g. after fetching records"
          className="h-8 text-[12px]"
        />
        <p className="text-[10px] text-slate-400">
          Shown alongside this node's captured snapshot when viewing a past execution — useful for telling multiple debug nodes apart.
        </p>
      </div>

      <div className="h-px bg-slate-100" />

      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Watches (optional)</Label>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {watches.length}
        </span>
      </div>
      <p className="-mt-2 text-[10px] text-slate-400">
        Each watch evaluates an expression at this point in the graph and captures the result — for narrowing in on one specific value instead of scanning the whole variable dump. Has no effect on control flow or variable state, and a bad expression is captured as its own error, never fails this node.
      </p>

      {watches.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          No watches yet — click Add below.
        </div>
      )}

      <div className="space-y-2">
        {watches.map((w, idx) => (
          <WatchRow
            key={w.id}
            index={idx}
            watch={w}
            onChange={(patch) => update(w.id, patch)}
            onDelete={() => remove(w.id)}
            onOpenEditor={() => setEditorOpen(w.id)}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-700"
      >
        <Plus size={13} />
        Add Watch
      </Button>

      {openingWatch && (
        <ExpressionEditor
          open={editorOpen !== null}
          onClose={() => setEditorOpen(null)}
          value={openingWatch.expression}
          onChange={(expr) => update(openingWatch.id, { expression: expr })}
          variables={variables}
          nodeContext={nodeContext}
          label={openingWatch.name || 'watch'}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single watch row
// ---------------------------------------------------------------------------

interface WatchRowProps {
  index: number
  watch: DebugWatch
  onChange: (patch: Partial<DebugWatch>) => void
  onDelete: () => void
  onOpenEditor: () => void
}

function WatchRow({ index, watch, onChange, onDelete, onOpenEditor }: WatchRowProps) {
  return (
    <div className="group relative rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-shadow hover:shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
          {index + 1}
        </span>
        <input
          value={watch.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Name (e.g. total)"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
          title="Remove watch"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-start gap-1.5">
        <div className="relative flex-1">
          <Braces size={11} className="absolute left-2.5 top-2 text-indigo-400" />
          <textarea
            value={watch.expression}
            onChange={(e) => onChange({ expression: e.target.value })}
            placeholder='e.g. Vars["count"] + 1'
            rows={2}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 font-mono text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          onClick={onOpenEditor}
          title="Open expression editor"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Code2 size={13} />
        </button>
      </div>
    </div>
  )
}
