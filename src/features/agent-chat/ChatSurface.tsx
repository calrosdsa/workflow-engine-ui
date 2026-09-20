import { useState } from 'react'
import { Check, CircleHelp, X, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatSurface as ChatSurfaceData, ConfirmSurface, FormSurface, ChoiceSurface } from './types'

interface ChatSurfaceProps {
  surface: ChatSurfaceData
  busy?: boolean
  onConfirm?: (callId: string, approved: boolean) => void
}

export function ChatSurface({ surface, busy = false, onConfirm }: ChatSurfaceProps) {
  switch (surface.kind) {
    case 'confirm':
      return <ConfirmSurfaceView surface={surface} busy={busy} onConfirm={onConfirm} />
    case 'form':
      return <FormSurfaceView surface={surface} />
    case 'choice':
      return <ChoiceSurfaceView surface={surface} />
  }
}

function ConfirmSurfaceView({ surface, busy, onConfirm }: { surface: ConfirmSurface; busy: boolean; onConfirm?: ChatSurfaceProps['onConfirm'] }) {
  const resolved = surface.status && surface.status !== 'pending'
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
            {surface.status === 'approved' ? 'Approved.' : 'Denied.'}
          </p>
        ) : onConfirm ? (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onConfirm(surface.call_id, true)} disabled={busy}>
              <Check size={13} />Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onConfirm(surface.call_id, false)} disabled={busy}>
              <X size={13} />Deny
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FormSurfaceView({ surface }: { surface: FormSurface }) {
  return (
    <div className="flex items-start justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium"><CircleHelp size={13} />{surface.title}</div>
        {surface.description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{surface.description}</p>}
        <div className="mt-2 space-y-2">
          {surface.fields.map((field) => (
            <label key={field.name} className="block text-xs">
              <span className="mb-1 block font-medium">{field.label}{field.required ? ' *' : ''}</span>
              {field.type === 'textarea' ? <textarea disabled rows={2} className="w-full rounded-md border bg-transparent px-2 py-1" /> : <input disabled type={field.type === 'number' ? 'number' : 'text'} className="w-full rounded-md border bg-transparent px-2 py-1" />}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">This form is awaiting an action handler.</p>
      </div>
    </div>
  )
}

function ChoiceSurfaceView({ surface }: { surface: ChoiceSurface }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="flex items-start justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium"><CircleHelp size={13} />{surface.title}</div>
        {surface.description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{surface.description}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {surface.options.map((option) => (
            <Button key={option.value} size="sm" variant={selected === option.value ? 'default' : 'outline'} onClick={() => setSelected(option.value)}>
              {option.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">This choice is awaiting an action handler.</p>
      </div>
    </div>
  )
}
