import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Check, ExternalLink, Play, Plus, Trash2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import {
  useEvaluationDataset, useEvaluationDatasetRows, useEvaluationRuns, useEvaluationRunResults,
  useAddEvaluationRow, useDeleteEvaluationRow, useRunEvaluation, useSetEvaluationVerdict,
} from '@/features/evaluations/hooks'
import type { EvaluationDatasetRow, EvaluationRowResult, EvaluationRun } from '@/features/evaluations/types'
import { extractApiError } from '@/lib/api'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const RUN_STATUS_VARIANT: Record<EvaluationRun['status'], 'warning' | 'default' | 'success' | 'destructive' | 'secondary'> = {
  RUNNING:   'default',
  COMPLETED: 'success',
  FAILED:    'destructive',
  CANCELLED: 'secondary',
}

/**
 * Full dataset editor: the row table (test cases), run history, and a
 * selected run's per-row expected-vs-actual results with manual pass/fail
 * marking. This is a page, not a docked sidebar panel — a spreadsheet-like
 * row editor needs real width. New code throughout, so every user-facing
 * string routes through t() per workflow-engine-ui/CLAUDE.md.
 *
 * v1 scope note: variables/trigger_record are edited as raw JSON text
 * (parsed on submit) rather than a dynamic form generated from the
 * workflow's declared variables — a reasonable, functional simplification
 * for this pass, not a dynamic per-field editor.
 */
export function EvaluationDatasetPage() {
  const t = useTranslation()
  const appId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const { workflowId, datasetId } = useParams({ from: '/shell/applications/$appId/workflows/$workflowId/evaluations/$datasetId' })

  const { data: dataset, isLoading: datasetLoading } = useEvaluationDataset(datasetId)
  const { data: rows, isLoading: rowsLoading } = useEvaluationDatasetRows(datasetId)
  const { data: runs } = useEvaluationRuns(datasetId)
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined)
  const [addingRow, setAddingRow] = useState(false)

  // Default to the most recent run once the list loads, without stomping a
  // run the user has since clicked on.
  useEffect(() => {
    if (selectedRunId === undefined && runs && runs.length > 0) setSelectedRunId(runs[0].id)
  }, [runs, selectedRunId])

  const runMutation = useRunEvaluation(datasetId)
  const deleteRowMutation = useDeleteEvaluationRow(datasetId)
  const selectedRun = runs?.find((r) => r.id === selectedRunId)
  const { data: results } = useEvaluationRunResults(selectedRunId, { runStatus: selectedRun?.status })

  if (datasetLoading || !dataset) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          to="/applications/$appId/workflows/$workflowId"
          params={{ appId, workflowId }}
          className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft size={12} />{t('workflows.evaluations.page.back_to_workflow')}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{dataset.name}</h1>
          <Badge variant="secondary">{t('workflows.evaluations.page.output_variable_badge', { name: dataset.output_variable })}</Badge>
        </div>
        {dataset.description && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{dataset.description}</p>}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('workflows.evaluations.page.rows_title', { count: rows?.length ?? 0 })}</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddingRow((a) => !a)}>
              <Plus size={14} />{t('workflows.evaluations.page.add_row')}
            </Button>
            <Button
              size="sm"
              disabled={(rows?.length ?? 0) === 0 || runMutation.isPending}
              onClick={() => runMutation.mutate(undefined, { onSuccess: (res) => setSelectedRunId(res.run_id) })}
            >
              {runMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Play size={14} />}
              {t('workflows.evaluations.page.run_now')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {addingRow && <AddRowForm datasetId={datasetId} onDone={() => setAddingRow(false)} />}
          {rowsLoading && <div className="flex justify-center py-4"><Spinner className="h-4 w-4" /></div>}
          {!rowsLoading && (rows?.length ?? 0) === 0 && !addingRow && (
            <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.page.no_rows')}</p>
          )}
          {rows?.map((row) => (
            <RowCard key={row.id} row={row} onDelete={() => deleteRowMutation.mutate(row.id)} deleting={deleteRowMutation.isPending} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('workflows.evaluations.page.runs_title')}</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(runs?.length ?? 0) === 0 && <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.page.no_runs')}</p>}
          {runs?.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelectedRunId(run.id)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                run.id === selectedRunId ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]',
              )}
            >
              <div className="flex items-center gap-2">
                <Badge variant={RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
                <span className="text-[hsl(var(--muted-foreground))]">{new Date(run.started_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                <span>{t('workflows.evaluations.page.run_progress', { completed: run.completed_rows, total: run.total_rows })}</span>
                <span className="text-[hsl(var(--success))]">{run.passed_rows}✓</span>
                <span className="text-[hsl(var(--destructive))]">{run.failed_rows}✗</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {selectedRunId && (
        <Card>
          <CardHeader><CardTitle>{t('workflows.evaluations.page.results_title')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results?.length === 0 && <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.page.no_results_yet')}</p>}
            {results?.map((result) => (
              <ResultCard key={result.id} result={result} runId={selectedRunId} appId={appId} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AddRowForm({ datasetId, onDone }: { datasetId: string; onDone: () => void }) {
  const t = useTranslation()
  const addRowMutation = useAddEvaluationRow(datasetId)
  const [name, setName] = useState('')
  const [variablesText, setVariablesText] = useState('{}')
  const [triggerRecordText, setTriggerRecordText] = useState('')
  const [expectedOutput, setExpectedOutput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const submit = () => {
    let variables: Record<string, unknown> = {}
    let triggerRecord: Record<string, unknown> | undefined
    try {
      variables = variablesText.trim() ? JSON.parse(variablesText) : {}
      triggerRecord = triggerRecordText.trim() ? JSON.parse(triggerRecordText) : undefined
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : String(err))
      return
    }
    setJsonError(null)
    addRowMutation.mutate(
      { name: name.trim() || undefined, variables, trigger_record: triggerRecord, expected_output: expectedOutput.trim() || undefined },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
      <div>
        <Label className="text-xs">{t('workflows.evaluations.page.row_name')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" autoFocus />
      </div>
      <div>
        <Label className="text-xs">{t('workflows.evaluations.page.variables_json')}</Label>
        <textarea
          value={variablesText}
          onChange={(e) => setVariablesText(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 font-mono text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        />
      </div>
      <div>
        <Label className="text-xs">{t('workflows.evaluations.page.trigger_record_json')}</Label>
        <textarea
          value={triggerRecordText}
          onChange={(e) => setTriggerRecordText(e.target.value)}
          rows={2}
          placeholder="{}"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 font-mono text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        />
      </div>
      <div>
        <Label className="text-xs">{t('workflows.evaluations.page.expected_output')}</Label>
        <Input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} className="h-8 text-sm" />
      </div>
      {jsonError && <p className="text-xs text-[hsl(var(--destructive))]">{jsonError}</p>}
      {addRowMutation.isError && <p className="text-xs text-[hsl(var(--destructive))]">{extractApiError(addRowMutation.error)}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>{t('common.cancel')}</Button>
        <Button size="sm" disabled={addRowMutation.isPending} onClick={submit}>
          {addRowMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : t('common.save')}
        </Button>
      </div>
    </div>
  )
}

function RowCard({ row, onDelete, deleting }: { row: EvaluationDatasetRow; onDelete: () => void; deleting: boolean }) {
  const t = useTranslation()
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-[hsl(var(--border))] p-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{row.name || t('workflows.evaluations.page.unnamed_row', { order: row.row_order })}</div>
        <pre className="overflow-x-auto rounded bg-[hsl(var(--muted))] p-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">{JSON.stringify(row.variables)}</pre>
        {row.expected_output && (
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            <span className="font-medium">{t('workflows.evaluations.page.expected_output')}:</span> {row.expected_output}
          </div>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" disabled={deleting} onClick={onDelete}>
        <Trash2 size={13} />
      </Button>
    </div>
  )
}

function ResultCard({ result, runId, appId }: { result: EvaluationRowResult; runId: string; appId: string }) {
  const t = useTranslation()
  const setVerdictMutation = useSetEvaluationVerdict(runId)
  const matches = result.expected_output !== undefined && result.expected_output === result.actual_output

  return (
    <div className="space-y-1.5 rounded-md border border-[hsl(var(--border))] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{result.row_name || t('workflows.evaluations.page.unnamed_row', { order: result.row_order })}</span>
        <div className="flex items-center gap-2">
          {result.status === 'FAILED' && <Badge variant="destructive">{t('workflows.evaluations.page.replay_failed')}</Badge>}
          {result.execution_id && (
            <Link
              to="/applications/$appId/executions/$executionId"
              params={{ appId, executionId: result.execution_id }}
              className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              {t('workflows.evaluations.page.view_trace')}<ExternalLink size={11} />
            </Link>
          )}
        </div>
      </div>

      {result.error_message && <p className="text-xs text-[hsl(var(--destructive))]">{result.error_message}</p>}

      {result.status !== 'FAILED' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.page.expected')}</div>
            <div className="mt-0.5 whitespace-pre-wrap rounded bg-[hsl(var(--muted))] p-1.5 text-xs text-[hsl(var(--foreground))]">{result.expected_output ?? t('workflows.evaluations.page.no_expected_output')}</div>
          </div>
          <div>
            <div className={cn('text-[10px] font-medium uppercase tracking-wide', matches ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--muted-foreground))]')}>{t('workflows.evaluations.page.actual')}</div>
            <div className="mt-0.5 whitespace-pre-wrap rounded bg-[hsl(var(--muted))] p-1.5 text-xs text-[hsl(var(--foreground))]">{result.actual_output ?? '—'}</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={result.manual_verdict === 'pass' ? 'default' : 'outline'}
          className="h-6 px-2 text-[10px]"
          onClick={() => setVerdictMutation.mutate({ resultId: result.id, verdict: 'pass' })}
        >
          <Check size={11} />{t('workflows.evaluations.page.mark_pass')}
        </Button>
        <Button
          size="sm"
          variant={result.manual_verdict === 'fail' ? 'destructive' : 'outline'}
          className="h-6 px-2 text-[10px]"
          onClick={() => setVerdictMutation.mutate({ resultId: result.id, verdict: 'fail' })}
        >
          <X size={11} />{t('workflows.evaluations.page.mark_fail')}
        </Button>
        {!result.manual_verdict && <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.evaluations.page.not_reviewed')}</span>}
      </div>
    </div>
  )
}
