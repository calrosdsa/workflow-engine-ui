import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FlaskConical, Play, Plus, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useEvaluationDatasets, useCreateEvaluationDataset, useRunEvaluation, useEvaluationRuns } from '@/features/evaluations/hooks'
import type { EvaluationDataset } from '@/features/evaluations/types'
import { extractApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useBuilderStore } from './store'
import { useTranslation } from '@/features/i18n/I18nProvider'

/**
 * Launcher/summary panel for Workflow Evaluations v1 — lists this workflow's
 * test datasets (each a hand-curated set of sample inputs + optional
 * expected output), with a "Run" shortcut and a link into the full editor
 * page (EvaluationDatasetPage) for row authoring and reviewing results.
 * Modeled on ExecutionsSidebar's own shape, but this is new code (not a
 * grandfathered-plain-literal sibling), so its own strings route through
 * t() per workflow-engine-ui/CLAUDE.md.
 */
export function EvaluationsSidebar({ workflowId }: { workflowId: string }) {
  const t = useTranslation()
  const appId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const open = useBuilderStore((s) => s.evaluationsPanelOpen)
  const toggle = useBuilderStore((s) => s.toggleEvaluationsPanel)
  const { data: datasets, isLoading } = useEvaluationDatasets(workflowId)
  const [creating, setCreating] = useState(false)

  // Surfaced only through the header's "Evaluations" tab (WorkflowBuilderPage)
  // — no left-edge collapsed rail of its own, matching every other panel in
  // this exclusive-sidebar group.
  if (!open) return null

  return (
    <aside className="relative flex w-72 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]" aria-label={t('workflows.evaluations.sidebar.title')}>
      <header className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FlaskConical size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.evaluations.sidebar.title')}</span>
          {(datasets?.length ?? 0) > 0 && (
            <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{datasets?.length}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCreating((c) => !c)} title={t('workflows.evaluations.sidebar.new_dataset')}>
            <Plus size={14} />
          </Button>
          <button
            type="button"
            onClick={toggle}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            title={t('workflows.evaluations.sidebar.close')}
          >
            <X size={13} />
          </button>
        </div>
      </header>

      {creating && <CreateDatasetForm workflowId={workflowId} onDone={() => setCreating(false)} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center py-8"><Spinner className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></div>}
        {!isLoading && (datasets?.length ?? 0) === 0 && !creating && (
          <p className="px-3.5 py-6 text-center text-[11px] text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.sidebar.empty')}</p>
        )}
        {datasets?.map((dataset) => (
          <DatasetRow key={dataset.id} dataset={dataset} appId={appId} workflowId={workflowId} />
        ))}
      </div>
    </aside>
  )
}

function CreateDatasetForm({ workflowId, onDone }: { workflowId: string; onDone: () => void }) {
  const t = useTranslation()
  const variables = useBuilderStore((s) => s.variables)
  const [name, setName] = useState('')
  const [outputVariable, setOutputVariable] = useState(variables[0]?.name ?? '')
  const createMutation = useCreateEvaluationDataset(workflowId)

  const submit = () => {
    if (!name.trim() || !outputVariable) return
    createMutation.mutate(
      { name: name.trim(), output_variable: outputVariable },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
      <div>
        <Label className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.sidebar.dataset_name')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs" autoFocus />
      </div>
      <div>
        <Label className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.sidebar.output_variable')}</Label>
        {variables.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--destructive))]">{t('workflows.evaluations.sidebar.no_variables')}</p>
        ) : (
          <Select value={outputVariable} onChange={(e) => setOutputVariable(e.target.value)} className="h-7 text-xs">
            {variables.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </Select>
        )}
      </div>
      {createMutation.isError && (
        <p className="text-[10px] text-[hsl(var(--destructive))]">{extractApiError(createMutation.error)}</p>
      )}
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={onDone}>{t('common.cancel')}</Button>
        <Button size="sm" className="h-6 px-2 text-[11px]" disabled={!name.trim() || !outputVariable || createMutation.isPending} onClick={submit}>
          {createMutation.isPending ? <Spinner className="h-3 w-3" /> : t('common.create')}
        </Button>
      </div>
    </div>
  )
}

function DatasetRow({ dataset, appId, workflowId }: { dataset: EvaluationDataset; appId: string; workflowId: string }) {
  const t = useTranslation()
  const { data: runs } = useEvaluationRuns(dataset.id)
  const lastRun = runs?.[0]
  const runMutation = useRunEvaluation(dataset.id)

  return (
    <div className="border-b border-[hsl(var(--border))]/50 px-3.5 py-2.5">
      <Link
        to="/applications/$appId/workflows/$workflowId/evaluations/$datasetId"
        params={{ appId, workflowId, datasetId: dataset.id }}
        className="block text-[12px] font-semibold text-[hsl(var(--foreground))] hover:underline"
      >
        {dataset.name}
      </Link>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">
        <span>{t('workflows.evaluations.sidebar.row_count', { count: dataset.row_count })}</span>
        {lastRun && (lastRun.passed_rows > 0 || lastRun.failed_rows > 0) && (
          <span className="flex items-center gap-1">
            <span className="text-[hsl(var(--success))]">{lastRun.passed_rows}✓</span>
            <span className="text-[hsl(var(--destructive))]">{lastRun.failed_rows}✗</span>
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mt-1.5 h-6 w-full text-[10px]"
        disabled={dataset.row_count === 0 || runMutation.isPending}
        onClick={() => runMutation.mutate()}
        title={dataset.row_count === 0 ? t('workflows.evaluations.sidebar.no_rows_to_run') : undefined}
      >
        {runMutation.isPending ? <Spinner className="h-3 w-3" /> : <Play size={10} />}
        {t('workflows.evaluations.sidebar.run')}
      </Button>
    </div>
  )
}
