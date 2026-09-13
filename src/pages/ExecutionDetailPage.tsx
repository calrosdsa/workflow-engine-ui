import { useParams } from '@tanstack/react-router'
import { useExecution } from '@/features/executions/hooks'
import { ExecutionLogsPanel } from '@/features/executions/ExecutionLogsPanel'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { ExecutionStatus } from '@/features/executions/types'

const statusVariant: Record<ExecutionStatus, 'warning' | 'default' | 'success' | 'destructive' | 'secondary'> = {
  PENDING:   'warning',
  RUNNING:   'default',
  COMPLETED: 'success',
  FAILED:    'destructive',
  CANCELLED: 'secondary',
}

export function ExecutionDetailPage() {
  const t = useTranslation()
  const { executionId } = useParams({ from: '/shell/applications/$appId/executions/$executionId' })
  const { data: execution, isLoading } = useExecution(executionId)

  if (isLoading || !execution) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(execution.status)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Execution Detail</h1>
          <p className="font-mono text-xs text-[hsl(var(--muted-foreground))] mt-1">{execution.execution_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[execution.status]}>{execution.status}</Badge>
          {!isTerminal && <Spinner className="h-4 w-4 text-[hsl(var(--primary))]" />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard title="Temporal IDs">
          <Row label="Workflow ID" value={execution.temporal_workflow_id ?? '—'} mono />
          <Row label="Run ID"      value={execution.temporal_run_id ?? '—'}       mono />
        </InfoCard>
        <InfoCard title="Timeline">
          <Row label="Created"  value={fmt(execution.created_at)} />
          <Row label="Started"  value={fmt(execution.started_at)} />
          <Row label="Finished" value={fmt(execution.finished_at)} />
        </InfoCard>
      </div>

      {execution.error_message && (
        <Card className="border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10">
          <CardHeader><CardTitle className="text-[hsl(var(--destructive))] text-sm">Error</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs text-[hsl(var(--destructive))] whitespace-pre-wrap">{execution.error_message}</pre>
          </CardContent>
        </Card>
      )}

      {execution.final_variables && (
        <Card>
          <CardHeader><CardTitle>Final Variables</CardTitle></CardHeader>
          <CardContent>
            <pre className="rounded-md bg-[hsl(var(--muted))] p-4 text-xs overflow-auto">
              {JSON.stringify(execution.final_variables, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))]">{t('workflows.executions.logs.title')}</h2>
        <ExecutionLogsPanel executionId={execution.execution_id} executionStatus={execution.status} executionFinishedAt={execution.finished_at} />
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  )
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[hsl(var(--muted-foreground))] shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-xs text-[hsl(var(--foreground))] truncate' : 'text-[hsl(var(--foreground))]'}>{value ?? '—'}</span>
    </div>
  )
}

function fmt(ts?: string) {
  return ts ? new Date(ts).toLocaleString() : undefined
}
