import { useWorkflows } from '@/features/workflows/hooks'
import { useExecutions, useExecutionCount } from '@/features/executions/hooks'
import { useForms } from '@/features/forms/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Workflow, Play, FileText, CheckCircle } from 'lucide-react'
import { useI18n } from '@/features/i18n/I18nProvider'

// The "Recent Executions" card only ever shows 5 rows, so a small page_size
// is enough — the "Total"/"Completed" stat tiles read .total from their own
// dedicated count queries below instead of this page's length, since
// GET /executions is now paginated and this page's data is only ever one
// page's worth of rows.
const RECENT_EXECUTIONS_PAGE_SIZE = 5

export function DashboardPage() {
  const { t, locale } = useI18n()
  const { data: workflows } = useWorkflows()
  const { data: recent } = useExecutions({ pageSize: RECENT_EXECUTIONS_PAGE_SIZE })
  const { data: totalExecutions } = useExecutionCount()
  const { data: completed } = useExecutionCount('COMPLETED')
  const { data: forms } = useForms()

  const stats = [
    { label: t('dashboard.workflow_definitions'), value: workflows?.length ?? 0,   icon: Workflow,    color: 'text-[hsl(var(--primary))]',   bg: 'bg-[hsl(var(--primary))]/10' },
    { label: t('dashboard.total_executions'),     value: totalExecutions ?? 0,     icon: Play,        color: 'text-[hsl(var(--primary))]', bg: 'bg-[hsl(var(--primary))]/10' },
    { label: t('dashboard.completed'),            value: completed ?? 0,           icon: CheckCircle, color: 'text-[hsl(var(--success))]',  bg: 'bg-[hsl(var(--success))]/10' },
    { label: t('dashboard.form_definitions'),     value: forms?.length ?? 0,       icon: FileText,    color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning))]/10' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{t('dashboard.title')}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{label}</CardTitle>
                <div className={`rounded-lg p-2 ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[hsl(var(--foreground))]">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {recent && recent.executions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recent_executions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recent.executions.map((ex) => (
                <div key={ex.execution_id} className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] p-3 text-sm">
                  <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{ex.execution_id.slice(0, 8)}…</span>
                  <StatusBadge status={ex.status} />
                  <span className="text-[hsl(var(--muted-foreground))]">{new Date(ex.created_at).toLocaleString(locale)}</span>
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
    PENDING:   'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
    RUNNING:   'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]',
    COMPLETED: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
    FAILED:    'bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]',
    CANCELLED: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
      {status}
    </span>
  )
}
