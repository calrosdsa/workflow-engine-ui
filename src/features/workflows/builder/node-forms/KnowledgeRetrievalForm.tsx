// knowledge_retrieval — mirrors internal/graph/configs_rag.go's KnowledgeRetrievalConfig
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { KnowledgeBaseSelect } from '@/features/knowledge/KnowledgeBaseSelect'
import { cn } from '@/lib/utils'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, KnowledgeRetrievalConfig, KnowledgeQueryMode, ValueMode } from '../../types'

export function normaliseKnowledgeRetrievalConfig(raw: unknown): KnowledgeRetrievalConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<KnowledgeRetrievalConfig>
  return {
    kb_id:          r.kb_id ?? '',
    mode:           r.mode ?? 'mix',
    query_mode:     r.query_mode ?? 'static',
    query:          r.query ?? '',
    query_expr:     r.query_expr ?? '',
    include_answer: r.include_answer ?? true,
    response_type:  r.response_type ?? '',
    user_prompt:    r.user_prompt ?? '',
    top_k:          r.top_k,
    chunk_top_k:    r.chunk_top_k,
    output_var:     r.output_var ?? '',
  }
}

const MODES: { value: KnowledgeQueryMode; label: string; hint: string }[] = [
  { value: 'mix',    label: 'Mix',    hint: 'Knowledge graph + raw chunks (default, most thorough)' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Local + global knowledge graph search' },
  { value: 'local',  label: 'Local',  hint: 'Entity-focused: specific facts and details' },
  { value: 'global', label: 'Global', hint: 'Relationship-focused: themes and connections' },
  { value: 'naive',  label: 'Naive',  hint: 'Plain vector search over document chunks only' },
  { value: 'bypass', label: 'Bypass', hint: 'Skip retrieval — ask the LLM directly' },
]

function ModeToggle({ mode, onChange }: { mode: ValueMode; onChange: (m: ValueMode) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {(['static', 'expression'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {m === 'static' ? 'Static' : 'Expression'}
        </button>
      ))}
    </div>
  )
}

export interface KnowledgeRetrievalFormProps {
  config: KnowledgeRetrievalConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: KnowledgeRetrievalConfig) => void
}

export function KnowledgeRetrievalForm({ config, variables, nodeContext, onChange }: KnowledgeRetrievalFormProps) {
  const set = (patch: Partial<KnowledgeRetrievalConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Knowledge Base</Label>
        <KnowledgeBaseSelect value={config.kb_id || undefined} onChange={(id) => set({ kb_id: id ?? '' })} />
      </div>

      <div className="h-px bg-slate-100" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Query</Label>
        <ModeToggle mode={config.query_mode ?? 'static'} onChange={(m) => set({ query_mode: m })} />
        {config.query_mode === 'expression' ? (
          <ExpressionField
            value={config.query_expr ?? ''}
            onChange={(v) => set({ query_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder="e.g. Vars.user_question"
            label="Query"
          />
        ) : (
          <textarea
            value={config.query ?? ''}
            onChange={(e) => set({ query: e.target.value })}
            rows={2}
            placeholder="What would you like to know?"
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Retrieval Mode</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => set({ mode: m.value })}
              title={m.hint}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors',
                (config.mode ?? 'mix') === m.value
                  ? 'border-teal-400 bg-teal-50 text-teal-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Generate Answer</Label>
          <p className="text-[10px] text-slate-400">Off returns raw context only — useful for building a custom prompt downstream.</p>
        </div>
        <Switch checked={config.include_answer} onCheckedChange={(v) => set({ include_answer: v })} />
      </div>

      {config.include_answer && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Additional Instructions (optional)</Label>
          <Input
            value={config.user_prompt ?? ''}
            onChange={(e) => set({ user_prompt: e.target.value })}
            placeholder="e.g. Answer in a formal tone"
            className="h-8 text-[12px]"
          />
        </div>
      )}

      <div className="h-px bg-slate-100" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Output Variable</Label>
        <Input
          value={config.output_var}
          onChange={(e) => set({ output_var: e.target.value })}
          placeholder="kb_result"
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-slate-400">
          Result published as answer/context/chunks/references — both on this node's output and on the named variable.
        </p>
      </div>
    </div>
  )
}
