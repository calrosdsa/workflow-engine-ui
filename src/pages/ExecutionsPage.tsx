import { Link } from '@tanstack/react-router'
import { useExecutions } from '@/features/executions/hooks'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import type { ExecutionStatus } from '@/features/executions/types'

const statusVariant: Record<ExecutionStatus, 'warning' | 'default' | 'success' | 'destructive' | 'secondary'> = {
  PENDING:   'warning',
  RUNNING:   'default',
  COMPLETED: 'success',
  FAILED:    'destructive',
  CANCELLED: 'secondary',
}

export function ExecutionsPage() {
  const { data: executions, isLoading } = useExecutions()

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executions</h1>
        <p className="text-sm text-gray-500 mt-1">{executions?.length ?? 0} total</p>
      </div>

      {!executions?.length ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500">
          No executions yet. Trigger a workflow from the Workflows page.
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Execution ID', 'Status', 'Started', 'Finished', 'Duration'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {executions.map((ex) => {
                const started  = ex.started_at  ? new Date(ex.started_at)  : null
                const finished = ex.finished_at ? new Date(ex.finished_at) : null
                const duration = started && finished
                  ? `${((finished.getTime() - started.getTime()) / 1000).toFixed(1)}s`
                  : '—'

                return (
                  <tr key={ex.execution_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to="/executions/$executionId"
                        params={{ executionId: ex.execution_id }}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {ex.execution_id.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[ex.status]}>{ex.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {started ? started.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {finished ? finished.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{duration}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
