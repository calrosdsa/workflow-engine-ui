import { useEffect } from 'react'
import { CheckCircle2, CircleAlert, Settings2, X } from 'lucide-react'
import { useBuilderStore } from './store'
import { useTranslation } from '@/features/i18n/I18nProvider'

export interface SetupIssue {
  id: string
  label: string
  issue: string
}

/** Workflow-level setup keeps preflight requirements close to the canvas
 * without pretending that they are node parameters. */
export function WorkflowSetupDrawer({ open, onClose, issues, environment }: {
  open: boolean
  onClose: () => void
  issues: SetupIssue[]
  environment?: { linked?: boolean; role?: string }
}) {
  const t = useTranslation()
  const selectNode = useBuilderStore((state) => state.selectNode)
  const showCompletedSteps = useBuilderStore((state) => state.showCompletedSteps)
  const setShowCompletedSteps = useBuilderStore((state) => state.setShowCompletedSteps)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  const environmentSummary = !environment?.linked
    ? t('workflows.setup.standalone')
    : environment.role === 'production'
      ? t('workflows.setup.production')
      : t('workflows.setup.linked', { role: environment.role ?? 'environment' })

  return <div className="workflow-builder-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <dialog open className="workflow-builder-drawer" aria-label={t('workflows.setup.aria')}>
      <header className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] px-5 py-4">
        <div><div className="flex items-center gap-2"><Settings2 size={16} className="text-[hsl(var(--primary))]" /><h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('workflows.setup.title')}</h2></div><p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">{t('workflows.setup.description')}</p></div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]" title={t('workflows.setup.close')}><X size={16} /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/45 p-3"><p className="text-[11px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.setup.environment')}</p><p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{environmentSummary}</p></section>
        <section><div className="flex items-center justify-between gap-3"><div><p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.setup.required')}</p><p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{issues.length === 0 ? t('workflows.setup.everything_ready') : issues.length === 1 ? t('workflows.setup.needs_attention_one', { count: issues.length }) : t('workflows.setup.needs_attention', { count: issues.length })}</p></div>{issues.length === 0 ? <CheckCircle2 size={18} className="text-[hsl(var(--success))]" /> : <CircleAlert size={18} className="text-[hsl(var(--warning))]" />}</div>
          {issues.length > 0 && <div className="mt-3 space-y-2">{issues.map((issue) => <button key={issue.id} type="button" onClick={() => { selectNode(issue.id); onClose() }} className="flex w-full items-start gap-2 rounded-lg border border-[hsl(var(--border))] p-3 text-left transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"><CircleAlert size={14} className="mt-0.5 shrink-0 text-[hsl(var(--warning))]" /><span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-[hsl(var(--foreground))]">{issue.label}</span><span className="mt-0.5 block text-[11px] text-[hsl(var(--muted-foreground))]">{issue.issue}</span></span></button>)}</div>}
        </section>
        <section className="border-t border-[hsl(var(--border))] pt-5"><p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.setup.canvas_focus')}</p><button type="button" role="switch" aria-label={t('workflows.setup.show_completed')} aria-checked={showCompletedSteps} onClick={() => setShowCompletedSteps(!showCompletedSteps)} className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"><span><span className="block text-[12px] font-medium text-[hsl(var(--foreground))]">{t('workflows.setup.show_completed')}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{t('workflows.setup.show_completed_description')}</span></span><span aria-hidden="true" className={showCompletedSteps ? 'relative h-5 w-9 shrink-0 rounded-full bg-[hsl(var(--primary))]' : 'relative h-5 w-9 shrink-0 rounded-full bg-[hsl(var(--muted-foreground))]/35'}><span className={showCompletedSteps ? 'absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-[hsl(var(--primary-foreground))]' : 'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[hsl(var(--foreground))]'} /></span></button></section>
      </div>
    </dialog>
  </div>
}
