import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useExecutions } from '@/features/executions/hooks'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExecutionStatus } from '@/features/executions/types'

const statusVariant: Record<ExecutionStatus, 'warning' | 'default' | 'success' | 'destructive' | 'secondary'> = {
  PENDING:   'warning',
  RUNNING:   'default',
  COMPLETED: 'success',
  FAILED:    'destructive',
  CANCELLED: 'secondary',
}

const STATUS_FILTERS: Array<ExecutionStatus | 'ALL'> = ['ALL', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']
const PAGE_SIZE = 25

export function ExecutionsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ExecutionStatus | 'ALL'>('ALL')
  const { appId } = useParams({ strict: false }) as { appId?: string }

  const { data, isLoading } = useExecutions({
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  })
  const executions = data?.executions ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function changeStatus(next: ExecutionStatus | 'ALL') {
    setStatus(next)
    setPage(1) // a filter change invalidates whatever page we were on
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Executions</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{total} total</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                status === s ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/70',
              ].join(' ')}
            >
              {s === 'ALL' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : !executions.length ? (
        <div className="rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--muted-foreground))]">
          {status === 'ALL'
            ? 'No executions yet. Trigger a workflow from the Workflows page.'
            : `No ${status.toLowerCase()} executions.`}
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-x-auto">
            <table className="min-w-full divide-y divide-[hsl(var(--border))]">
              <thead className="bg-[hsl(var(--muted))]">
                <tr>
                  {['Execution ID', 'Status', 'Started', 'Finished', 'Duration'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {executions.map((ex) => {
                  const started  = ex.started_at  ? new Date(ex.started_at)  : null
                  const finished = ex.finished_at ? new Date(ex.finished_at) : null
                  const duration = started && finished
                    ? `${((finished.getTime() - started.getTime()) / 1000).toFixed(1)}s`
                    : '—'

                  return (
                    <tr key={ex.execution_id} className="hover:bg-[hsl(var(--muted))]">
                      <td className="px-4 py-3">
                        <Link
                          to="/applications/$appId/executions/$executionId"
                          params={{ appId: appId ?? '', executionId: ex.execution_id }}
                          className="font-mono text-xs text-[hsl(var(--primary))] hover:underline"
                        >
                          {ex.execution_id.slice(0, 12)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[ex.status]}>{ex.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                        {started ? started.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                        {finished ? finished.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{duration}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 gap-1 px-2">
                <ChevronLeft size={12} />Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 gap-1 px-2">
                Next<ChevronRight size={12} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
