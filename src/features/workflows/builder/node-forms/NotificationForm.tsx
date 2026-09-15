// notification — mirrors internal/graph/configs_notification.go
import { Bell } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { UserSelect } from '@/features/form-builder/config/UserSelect'
import { cn } from '@/lib/utils'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, NotificationConfig, NotificationSeverity, ValueMode } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

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
  { value: 'success', label: 'Success', activeClass: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' },
  { value: 'error',   label: 'Error',   activeClass: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]' },
  { value: 'warning', label: 'Warning', activeClass: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]' },
  { value: 'info',    label: 'Info',    activeClass: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' },
]

// Same visual language as HttpRequestForm's ModeToggle/StaticOrExprField.
function ModeToggle({ mode, onChange }: { mode: ValueMode; onChange: (m: ValueMode) => void }) {
  const { t } = useI18n()
  return (
    <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
      {(['static', 'expression'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {m === 'static' ? t('workflows.node_forms.static') : t('workflows.node_forms.expression')}
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
  const { t } = useI18n()
  const set = (patch: Partial<NotificationConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      {/* Recipient */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.recipient')}</Label>
        <ModeToggle mode={config.recipient_mode} onChange={(m) => set({ recipient_mode: m })} />
        {config.recipient_mode === 'expression' ? (
          <ExpressionField
            value={config.recipient_expr ?? ''}
            onChange={(v) => set({ recipient_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder='e.g. record.assigned_to_user_id'
            label={t('workflows.node_forms.recipient')}
          />
        ) : (
          <UserSelect
            value={config.recipient_user_id ?? ''}
            onChange={(userId) => set({ recipient_user_id: userId })}
          />
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.notification_help')}
        </p>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      {/* Severity */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.severity')}</Label>
        <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set({ severity: s.value })}
              className={cn(
                'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
                config.severity === s.value ? `${s.activeClass} shadow-sm` : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {s.value === 'success' ? t('common.success') : s.value === 'error' ? t('common.error') : s.value === 'warning' ? t('common.warning') : t('common.info')}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.title')}</Label>
        <Input
          value={config.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="New task assigned"
          className="h-8 text-[12px]"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.body')}</Label>
        <div className="relative">
          <Bell size={11} className="absolute left-2.5 top-2.5 text-[hsl(var(--primary))]" />
          <textarea
            value={config.body ?? ''}
            onChange={(e) => set({ body: e.target.value })}
            rows={3}
            placeholder="You have a new task waiting for review."
            className="w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-2 pl-7 pr-3 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
          />
        </div>
      </div>

      {/* Link URL */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.link_url')}</Label>
        <Input
          value={config.link_url ?? ''}
          onChange={(e) => set({ link_url: e.target.value })}
          placeholder="/tasks/123"
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.notification_path_help')}
        </p>
      </div>
    </div>
  )
}
