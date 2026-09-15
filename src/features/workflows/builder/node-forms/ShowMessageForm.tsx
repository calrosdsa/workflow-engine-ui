// show_message — mirrors internal/graph/configs_message.go
import { MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ShowMessageConfig, MessageType } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

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
  { value: 'success', label: 'Success', activeClass: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' },
  { value: 'error',   label: 'Error',   activeClass: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]' },
  { value: 'info',    label: 'Info',    activeClass: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' },
]

export interface ShowMessageFormProps {
  config: ShowMessageConfig
  onChange: (c: ShowMessageConfig) => void
}

export function ShowMessageForm({ config, onChange }: ShowMessageFormProps) {
  const { t } = useI18n()
  const set = (patch: Partial<ShowMessageConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Message type */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.message_type')}</Label>
        <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
          {MESSAGE_TYPES.map((messageType) => (
            <button
              key={messageType.value}
              type="button"
              onClick={() => set({ message_type: messageType.value })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.message_type === messageType.value ? `${messageType.activeClass} shadow-sm` : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {messageType.value === 'success' ? t('common.success') : messageType.value === 'error' ? t('common.error') : t('common.info')}
            </button>
          ))}
        </div>
        {config.message_type === 'error' && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t('workflows.node_forms.message_error_help')}
          </p>
        )}
      </div>

      {/* Message body — plain text/HTML only; the backend never evaluates
          this as an expression (see internal/activities/show_message.go).
          A dynamic value has to be composed upstream by a Set Variable
          node's expression assignment — this field itself is a literal
          string end to end. */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.message')}</Label>
        <div className="relative">
          <MessageSquare size={11} className="absolute left-2.5 top-2.5 text-[hsl(var(--primary))]" />
          <textarea
            value={config.message}
            onChange={(e) => set({ message: e.target.value })}
            rows={4}
            placeholder={config.is_html ? '<p>Order confirmed.</p>' : 'Order confirmed.'}
            className="w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-2 pl-7 pr-3 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
          />
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.message_help')}
        </p>
      </div>

      {/* is_html toggle */}
      <label className="flex items-center gap-2 text-[12px] text-[hsl(var(--foreground))]/80">
        <input
          type="checkbox"
          checked={config.is_html ?? false}
          onChange={(e) => set({ is_html: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/40"
        />
        {t('workflows.node_forms.html_message')}
      </label>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.auto_dismiss')}</Label>
        <Input
          type="number"
          min={0}
          value={config.timeout_ms || ''}
          onChange={(e) => set({ timeout_ms: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
          placeholder={t('workflows.node_forms.no_auto_dismiss')}
          className="h-8 w-40 text-[12px]"
        />
      </div>
    </div>
  )
}
