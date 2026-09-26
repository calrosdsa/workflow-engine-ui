import { useEffect } from 'react'
import type { StoryDefault } from '@ladle/react'
import { AlertCircle, CheckCircle2, Database, GripVertical, Loader2 } from 'lucide-react'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/b612-mono/400.css'
import '@fontsource/b612-mono/700.css'
import '@/pages/workflows/workflow-builder.css'

export default {
  title: 'Workflow builder/Node',
} satisfies StoryDefault

type NodePreviewState = 'default' | 'hover' | 'focus' | 'route' | 'active' | 'disabled' | 'loading' | 'error' | 'success'

const previewStates: NodePreviewState[] = ['default', 'hover', 'focus', 'route', 'active', 'disabled', 'loading', 'error', 'success']

const previewStateClass: Partial<Record<NodePreviewState, string>> = {
  hover: 'workflow-node--preview-hover',
  focus: 'workflow-node--preview-focus',
  active: 'workflow-node--preview-active',
  disabled: 'workflow-node--preview-disabled',
  loading: 'workflow-node--preview-loading',
  error: 'workflow-node--preview-error',
  success: 'workflow-node--preview-success',
}

const previewLamp: Partial<Record<NodePreviewState, string>> = {
  focus: 'route',
  route: 'route',
  loading: 'running',
  error: 'failed',
  success: 'completed',
}

function NodePreview({ state }: { state: NodePreviewState }) {
  const status = state === 'loading'
    ? { className: 'workflow-node-status--running', label: 'Running', icon: <Loader2 size={10} strokeWidth={3} className="animate-spin" /> }
    : state === 'error'
      ? { className: 'workflow-node-status--failed', label: 'Failed · 1.2s', icon: <AlertCircle size={10} strokeWidth={3} /> }
      : state === 'success'
        ? { className: 'workflow-node-status--completed', label: 'Completed · 340ms', icon: <CheckCircle2 size={10} strokeWidth={3} /> }
        : null

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold capitalize text-[hsl(var(--muted-foreground))]">{state}</p>
      <div
        className={`workflow-node relative ${previewStateClass[state] ?? ''}`}
        data-node-category="data"
        data-lever="data"
        data-selected={state === 'focus' ? 'true' : 'false'}
        data-execution-state={state === 'loading' ? 'running' : state === 'error' ? 'failed' : state === 'success' ? 'completed' : undefined}
        aria-disabled={state === 'disabled' || undefined}
      >
        <span className="workflow-node-handle workflow-node-handle--input absolute -left-1.5 top-1/2 -translate-y-1/2" />
        <div className="workflow-node-header flex items-center gap-2 px-2.5 py-2">
          <span className="workflow-node-drag-handle flex h-7 w-4 items-center justify-center rounded" aria-hidden="true">
            <GripVertical size={14} strokeWidth={2.25} />
          </span>
          <span className="workflow-node-icon wf-lever-tile flex h-7 w-7 items-center justify-center rounded-md" aria-hidden="true">
            <Database size={15} strokeWidth={2.25} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="workflow-node-title block truncate">Load customer</span>
            <span className="workflow-node-meta block truncate">Fetch records</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="workflow-node-lamp" data-lamp={previewLamp[state] ?? 'off'} aria-hidden="true" />
            <span className="workflow-node-step" title="Execution step 2">2</span>
          </span>
        </div>
        <div className="workflow-node-body px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px]">
            <code className="wf-chip">single</code>
            <span className="text-[hsl(var(--muted-foreground))]">· 2 filters</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            <span className="text-[hsl(var(--muted-foreground))]/60">→</span>
            <code className="truncate font-semibold text-[hsl(var(--foreground))]">customer</code>
          </div>
        </div>
        <span className="workflow-node-handle workflow-node-handle--output absolute -right-1.5 top-1/2 -translate-y-1/2" />
        {status && (
          <span className={`workflow-node-status absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${status.className}`}>
            {status.icon}<span>{status.label}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export const States = () => {
  // The editor sets this on <html> while it is open; the story does the same
  // so the Signal box palette and type apply.
  useEffect(() => {
    document.documentElement.dataset.surface = 'workflow-editor'
    return () => { delete document.documentElement.dataset.surface }
  }, [])

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-8 text-[hsl(var(--foreground))]">
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold">Workflow node states</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">One station plate across interaction and run states. Only the lamp, the readout and the border carry run state.</p>
        <div
          className="mt-8 grid gap-x-12 gap-y-8"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14.5rem), 1fr))' }}
        >
          {previewStates.map((state) => <NodePreview key={state} state={state} />)}
        </div>
      </div>
    </div>
  )
}
