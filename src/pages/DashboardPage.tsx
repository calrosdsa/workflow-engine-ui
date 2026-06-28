import { useWorkflows } from '@/features/workflows/hooks'
import { useExecutions } from '@/features/executions/hooks'
import { useForms } from '@/features/forms/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Workflow, Play, FileText, CheckCircle } from 'lucide-react'

export function DashboardPage() {
  const { data: workflows } = useWorkflows()
  const { data: executions } = useExecutions()
  const { data: forms } = useForms()

  const completed = executions?.filter((e) => e.status === 'COMPLETED').length ?? 0

  const stats = [
    { label: 'Workflow Definitions', value: workflows?.length ?? 0, icon: Workflow,    color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Total Executions',     value: executions?.length ?? 0, icon: Play,        color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Completed',            value: completed,                icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Form Definitions',     value: forms?.length ?? 0,       icon: FileText,    color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your workflow engine</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                <div className={`rounded-lg p-2 ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {executions && executions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {executions.slice(0, 5).map((ex) => (
                <div key={ex.execution_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span className="font-mono text-xs text-gray-500">{ex.execution_id.slice(0, 8)}…</span>
                  <StatusBadge status={ex.status} />
                  <span className="text-gray-400">{new Date(ex.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING:   'bg-yellow-100 text-yellow-800',
    RUNNING:   'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED:    'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}
