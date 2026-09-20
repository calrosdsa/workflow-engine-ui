import { useState } from 'react'
import { Check, CircleHelp, X, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatSurface as ChatSurfaceData, ConfirmSurface, FormSurface, ChoiceSurface } from './types'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface ChatSurfaceProps {
  surface: ChatSurfaceData
  busy?: boolean
  onConfirm?: (surface: ConfirmSurface, approved: boolean) => void
  onSubmit?: (surface: FormSurface | ChoiceSurface, payload: Record<string, unknown>) => Promise<void> | void
}

export function ChatSurface({ surface, busy = false, onConfirm, onSubmit }: ChatSurfaceProps) {
  switch (surface.kind) {
    case 'confirm':
      return <ConfirmSurfaceView surface={surface} busy={busy} onConfirm={onConfirm} />
    case 'form':
      return <FormSurfaceView surface={surface} busy={busy} onSubmit={onSubmit} />
    case 'choice':
      return <ChoiceSurfaceView surface={surface} busy={busy} onSubmit={onSubmit} />
  }
}

function ConfirmSurfaceView({ surface, busy, onConfirm }: { surface: ConfirmSurface; busy: boolean; onConfirm?: ChatSurfaceProps['onConfirm'] }) {
  const t = useTranslation()
  const actionable = (surface.state === undefined || surface.state === 'open' || surface.state === 'pending')
    && (surface.status === undefined || surface.status === 'pending')
    && !!surface.run_id
    && !!surface.approval_id
  const resolved = !actionable
  return (
    <div className="flex items-start justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          <Wrench size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          {surface.title}
          {surface.tool_name && <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-xs">{surface.tool_name}</code>}
        </div>
        {surface.description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{surface.description}</p>}
        {surface.arguments && Object.keys(surface.arguments).length > 0 && (
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-[hsl(var(--muted))] p-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            {JSON.stringify(surface.arguments, null, 2)}
          </pre>
        )}
        {resolved ? (
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            {surface.status === 'approved'
              ? t('agent_chat.approved')
              : surface.status === 'denied'
                ? t('agent_chat.denied')
                : t('agent_chat.no_longer_available')}
          </p>
        ) : actionable && onConfirm ? (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onConfirm(surface, true)} disabled={busy}>
              <Check size={13} />{t('agent_chat.approve')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onConfirm(surface, false)} disabled={busy}>
              <X size={13} />{t('agent_chat.deny')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FormSurfaceView({ surface, busy, onSubmit }: { surface: FormSurface; busy: boolean; onSubmit?: ChatSurfaceProps['onSubmit'] }) {
  const t = useTranslation()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(surface.state === 'submitted' || surface.state === 'resolved')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const missing = surface.fields.find((field) => field.required && (values[field.name] === undefined || values[field.name] === ''))
    if (missing) {
      setError(t('agent_chat.required_field'))
      return
    }
    setError(null)
    try {
      await onSubmit?.(surface, values)
      setSubmitted(true)
    } catch {
      setError(t('agent_chat.submit_failed'))
    }
  }

  return (
    <div className="flex items-start justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium"><CircleHelp size={13} />{surface.title}</div>
        {surface.description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{surface.description}</p>}
        <div className="mt-2 space-y-2">
          {surface.fields.map((field) => (
            <label key={field.name} className="block text-xs">
              <span className="mb-1 block font-medium">{field.label}{field.required ? ' *' : ''}</span>
              {field.description && <span className="mb-1 block text-[11px] text-[hsl(var(--muted-foreground))]">{field.description}</span>}
              {field.type === 'textarea' ? (
                <textarea disabled={busy || submitted} rows={2} value={String(values[field.name] ?? '')} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="w-full rounded-md border bg-transparent px-2 py-1" />
              ) : field.type === 'boolean' ? (
                <input disabled={busy || submitted} type="checkbox" checked={values[field.name] === true} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))} className="h-4 w-4 rounded border" />
              ) : (
                <input disabled={busy || submitted} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'} value={String(values[field.name] ?? '')} onChange={(event) => setValues((current) => ({ ...current, [field.name]: field.type === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value }))} className="w-full rounded-md border bg-transparent px-2 py-1" />
              )}
            </label>
          ))}
        </div>
        {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
        {submitted ? (
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('agent_chat.surface_submitted')}</p>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('agent_chat.form_awaiting_action')}</p>
            <Button size="sm" onClick={() => void submit()} disabled={busy || !onSubmit}>{t('agent_chat.submit_surface')}</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ChoiceSurfaceView({ surface, busy, onSubmit }: { surface: ChoiceSurface; busy: boolean; onSubmit?: ChatSurfaceProps['onSubmit'] }) {
  const t = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(surface.state === 'submitted' || surface.state === 'resolved')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!selected) {
      setError(t('agent_chat.choice_select'))
      return
    }
    setError(null)
    try {
      await onSubmit?.(surface, { value: selected })
      setSubmitted(true)
    } catch {
      setError(t('agent_chat.submit_failed'))
    }
  }

  return (
    <div className="flex items-start justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium"><CircleHelp size={13} />{surface.title}</div>
        {surface.description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{surface.description}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {surface.options.map((option) => (
            <Button key={option.value} size="sm" type="button" disabled={busy || submitted} variant={selected === option.value ? 'default' : 'outline'} onClick={() => setSelected(option.value)}>
              <span>{option.label}</span>
            </Button>
          ))}
        </div>
        {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
        {submitted ? (
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('agent_chat.surface_submitted')}</p>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('agent_chat.choice_awaiting_action')}</p>
            <Button size="sm" onClick={() => void submit()} disabled={busy || !selected || !onSubmit}>{t('agent_chat.submit_surface')}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
