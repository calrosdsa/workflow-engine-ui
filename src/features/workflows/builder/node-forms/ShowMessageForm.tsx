// show_message — mirrors internal/graph/configs_message.go
import { MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ShowMessageConfig, MessageType } from '../../types'

export function normaliseShowMessageConfig(raw: unknown): ShowMessageConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ShowMessageConfig>
  return {
    message:      r.message ?? '',
    is_html:      r.is_html ?? false,
    timeout_ms:   r.timeout_ms ?? 0,
    message_type: r.message_type ?? 'info',
  }
}

const MESSAGE_TYPES: { value: MessageType; label: string; activeClass: string }[] = [
  { value: 'success', label: 'Success', activeClass: 'bg-emerald-500 text-white' },
  { value: 'error',   label: 'Error',   activeClass: 'bg-red-500 text-white' },
  { value: 'info',    label: 'Info',    activeClass: 'bg-sky-500 text-white' },
]

export interface ShowMessageFormProps {
  config: ShowMessageConfig
  onChange: (c: ShowMessageConfig) => void
}

export function ShowMessageForm({ config, onChange }: ShowMessageFormProps) {
  const set = (patch: Partial<ShowMessageConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Message type */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message Type</Label>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {MESSAGE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set({ message_type: t.value })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.message_type === t.value ? `${t.activeClass} shadow-sm` : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {config.message_type === 'error' && (
          <p className="text-[10px] text-slate-400">
            Inside a Trigger's Before mode, an error message here blocks the write. In After/AfterAsync/on-demand runs it's a non-fatal warning.
          </p>
        )}
      </div>

      {/* Message body — plain text/HTML only; the backend never evaluates
          this as an expression (see internal/activities/show_message.go).
          A dynamic value has to be composed upstream by a Set Variable
          node's expression assignment — this field itself is a literal
          string end to end. */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Message</Label>
        <div className="relative">
          <MessageSquare size={11} className="absolute left-2.5 top-2.5 text-indigo-400" />
          <textarea
            value={config.message}
            onChange={(e) => set({ message: e.target.value })}
            rows={4}
            placeholder={config.is_html ? '<p>Order confirmed.</p>' : 'Order confirmed.'}
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-[12px] text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          Plain text or HTML only — not evaluated as an expression. For a dynamic value, build the string with a Set Variable node first.
        </p>
      </div>

      {/* is_html toggle */}
      <label className="flex items-center gap-2 text-[12px] text-slate-600">
        <input
          type="checkbox"
          checked={config.is_html ?? false}
          onChange={(e) => set({ is_html: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
        />
        Message contains HTML
      </label>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Auto-dismiss Timeout (ms)</Label>
        <Input
          type="number"
          min={0}
          value={config.timeout_ms || ''}
          onChange={(e) => set({ timeout_ms: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
          placeholder="0 = no auto-dismiss"
          className="h-8 w-40 text-[12px]"
        />
      </div>
    </div>
  )
}
