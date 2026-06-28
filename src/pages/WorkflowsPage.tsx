import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Trash2, Play, ExternalLink } from 'lucide-react'
import { useWorkflows, useDeleteWorkflow } from '@/features/workflows/hooks'
import { useTriggerExecution } from '@/features/executions/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { WorkflowDefinition } from '@/features/workflows/types'
// WorkflowDefinition now uses WorkflowDefinitionGraph (nodes+edges) — types updated

export function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows()
  const deleteMutation = useDeleteWorkflow()
  const triggerMutation = useTriggerExecution()
  const [triggeredId, setTriggeredId] = useState<string | null>(null)

  if (isLoading) return <PageLoader />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Definitions</h1>
          <p className="text-sm text-gray-500 mt-1">{workflows?.length ?? 0} definitions</p>
        </div>
        <Link to="/workflows/new">
          <Button><Plus size={16} />New Workflow</Button>
        </Link>
      </div>

      {triggeredId && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          Execution triggered — <Link to="/executions/$executionId" params={{ executionId: triggeredId }} className="underline font-medium">track it here</Link>
        </div>
      )}

      {!workflows?.length ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              wf={wf}
              onDelete={() => deleteMutation.mutate(wf.id)}
              onTrigger={() => triggerMutation.mutate(wf.id, { onSuccess: (r) => setTriggeredId(r.execution_id) })}
              isTriggering={triggerMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkflowCard({
  wf, onDelete, onTrigger, isTriggering,
}: {
  wf: WorkflowDefinition
  onDelete: () => void
  onTrigger: () => void
  isTriggering: boolean
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{wf.name}</CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{wf.id.slice(0, 8)}…</CardDescription>
          </div>
          <Link to="/workflows/$workflowId" params={{ workflowId: wf.id }}>
            <Button variant="ghost" size="icon"><ExternalLink size={14} /></Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-xs text-gray-500">
          {wf.definition.nodes?.length ?? 0} nodes · {wf.definition.edges?.length ?? 0} edges · {wf.definition.variables?.length ?? 0} variables
        </p>
        <p className="text-xs text-gray-400 mt-1">Updated {new Date(wf.updated_at).toLocaleDateString()}</p>
      </CardContent>
      <div className="flex gap-2 border-t p-4">
        <Button size="sm" onClick={onTrigger} disabled={isTriggering} className="flex-1">
          {isTriggering ? <Spinner className="h-4 w-4" /> : <Play size={14} />}
          Run
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 size={14} />
        </Button>
      </div>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <p className="text-gray-500 mb-4">No workflow definitions yet</p>
      <Link to="/workflows/new">
        <Button variant="outline"><Plus size={16} />Create your first workflow</Button>
      </Link>
    </div>
  )
}

function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner /></div>
}
