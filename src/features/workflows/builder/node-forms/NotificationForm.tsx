// notification — mirrors internal/graph/configs_notification.go
import { Bell } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { cn } from '@/lib/utils'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, NotificationConfig, NotificationSeverity, ValueMode } from '../../types'

export function normaliseNotificationConfig(raw: unknown): NotificationConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotificationConfig>
  return {
    recipient_mode:    r.recipient_mode ?? 'static',
    recipient_user_id: r.recipient_user_id ?? '',
    recipient_expr:    r.recipient_expr ?? '',
    title:             r.title ?? '',
    body:              r.body ?? '',
    severity:          r.severity ?? 'info',
    link_url:          r.link_url ?? '',
  }
}

const SEVERITIES: { value: NotificationSeverity; label: string; activeClass: string }[] = [
  { value: 'success', label: 'Success', activeClass: 'bg-emerald-500 text-white' },
  { value: 'error',   label: 'Error',   activeClass: 'bg-red-500 text-white' },
  { value: 'warning', label: 'Warning', activeClass: 'bg-amber-500 text-white' },
  { value: 'info',    label: 'Info',    activeClass: 'bg-sky-500 text-white' },
]

// Same visual language as HttpRequestForm's ModeToggle/StaticOrExprField.
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
            mode === m ? 'bg-fuchsia-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {m === 'static' ? 'Static' : 'Expression'}
        </button>
      ))}
    </div>
  )
}

export interface NotificationFormProps {
  config: NotificationConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: NotificationConfig) => void
}

export function NotificationForm({ config, variables, nodeContext, onChange }: NotificationFormProps) {
  const set = (patch: Partial<NotificationConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Recipient */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recipient</Label>
        <ModeToggle mode={config.recipient_mode} onChange={(m) => set({ recipient_mode: m })} />
        {config.recipient_mode === 'expression' ? (
          <ExpressionField
            value={config.recipient_expr ?? ''}
            onChange={(v) => set({ recipient_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder='e.g. record.assigned_to_user_id'
            label="Recipient"
          />
        ) : (
          <Input
            value={config.recipient_user_id ?? ''}
            onChange={(e) => set({ recipient_user_id: e.target.value })}
            placeholder="user id"
            className="h-8 font-mono text-[12px]"
          />
        )}
        <p className="text-[10px] text-slate-400">
          Who receives this notification — a literal user id, or an expression resolving to one (e.g. a record's assigned user).
        </p>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Severity */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Severity</Label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set({ severity: s.value })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.severity === s.value ? `${s.activeClass} shadow-sm` : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Title</Label>
        <Input
          value={config.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="New task assigned"
          className="h-8 text-[12px]"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Body (optional)</Label>
        <div className="relative">
          <Bell size={11} className="absolute left-2.5 top-2.5 text-fuchsia-400" />
          <textarea
            value={config.body ?? ''}
            onChange={(e) => set({ body: e.target.value })}
            rows={3}
            placeholder="You have a new task waiting for review."
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-fuchsia-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-100"
          />
        </div>
      </div>

      {/* Link URL */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Link URL (optional)</Label>
        <Input
          value={config.link_url ?? ''}
          onChange={(e) => set({ link_url: e.target.value })}
          placeholder="/tasks/123"
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-slate-400">
          In-app path opened when the recipient clicks this notification.
        </p>
      </div>
    </div>
  )
}
