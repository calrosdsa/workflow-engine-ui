// send_to_session — mirrors internal/graph/configs.go's
// SendToSessionConfig (FR-B2-030). No session picker exists — this
// codebase has no `sessions` feature/API layer to build one against
// (confirmed absent during FR-C5-013's grounding pass) — session_id stays
// a plain static/expression field, matching the backend's own deliberately
// simple config.
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { cn } from '@/lib/utils'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, SendToSessionConfig, ValueMode } from '../../types'

export function normaliseSendToSessionConfig(raw: unknown): SendToSessionConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SendToSessionConfig>
  return {
    session_id_mode: r.session_id_mode ?? 'static',
    session_id:      r.session_id ?? '',
    session_id_expr: r.session_id_expr ?? '',
    content_mode:    r.content_mode ?? 'static',
    content:         r.content ?? '',
    content_expr:    r.content_expr ?? '',
  }
}

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
            mode === m ? 'bg-violet-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {m === 'static' ? 'Static' : 'Expression'}
        </button>
      ))}
    </div>
  )
}

export interface SendToSessionFormProps {
  config: SendToSessionConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: SendToSessionConfig) => void
}

export function SendToSessionForm({ config, variables, nodeContext, onChange }: SendToSessionFormProps) {
  const set = (patch: Partial<SendToSessionConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Session ID</Label>
        <ModeToggle mode={config.session_id_mode ?? 'static'} onChange={(m) => set({ session_id_mode: m })} />
        {config.session_id_mode === 'expression' ? (
          <ExpressionField
            value={config.session_id_expr ?? ''}
            onChange={(v) => set({ session_id_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder="e.g. NodeOutputs.agent1.node_output.session_id"
            label="Session ID"
          />
        ) : (
          <Input
            value={config.session_id ?? ''}
            onChange={(e) => set({ session_id: e.target.value })}
            placeholder="Session UUID"
            className="h-8 font-mono text-[12px]"
          />
        )}
        <p className="text-[10px] text-slate-400">The target Agent session to post into — often a variable populated by an earlier Run Agent node.</p>
      </div>

      <div className="h-px bg-slate-100" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Content</Label>
        <ModeToggle mode={config.content_mode ?? 'static'} onChange={(m) => set({ content_mode: m })} />
        {config.content_mode === 'expression' ? (
          <ExpressionField
            value={config.content_expr ?? ''}
            onChange={(v) => set({ content_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder="e.g. Vars.result_text"
            label="Content"
          />
        ) : (
          <textarea
            value={config.content ?? ''}
            onChange={(e) => set({ content: e.target.value })}
            rows={4}
            placeholder="e.g. Your refund was processed."
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        )}
        <p className="text-[10px] text-slate-400">The message text posted into the session — no Agent run is started.</p>
      </div>
    </div>
  )
}
