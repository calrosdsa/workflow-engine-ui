import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Save, Play, CheckCircle, AlertCircle, Workflow } from 'lucide-react'
import { useWorkflow, useCreateWorkflow, useUpdateWorkflow } from '@/features/workflows/hooks'
import { useTriggerExecution } from '@/features/executions/hooks'
import { useBuilderStore } from '@/features/workflows/builder/store'
import { VariablesPanel } from '@/features/workflows/builder/VariablesPanel'
import { NodeConfigPanel } from '@/features/workflows/builder/NodeConfigPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { FlowLayout } from '../test/Layout'

export type BuilderMode = 'new' | 'edit'

interface WorkflowBuilderPageProps {
  mode: BuilderMode
}

export function WorkflowBuilderPage({ mode }: WorkflowBuilderPageProps) {
  const navigate = useNavigate()
  const params   = useParams({ strict: false }) as { workflowId?: string }
  const id       = mode === 'edit' ? (params.workflowId ?? '') : ''

  const { data: existing, isLoading } = useWorkflow(id)

  const { loadDefinition, toDefinition, name, setName, addNode, isDirty, markSaved } = useBuilderStore()

  const createMutation  = useCreateWorkflow()
  const updateMutation  = useUpdateWorkflow(id)
  const triggerMutation = useTriggerExecution()

  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [triggeredId,  setTriggeredId]  = useState<string | null>(null)
  const [initialised,  setInitialised]  = useState(false)

  // Load existing definition into the store once
  useEffect(() => {
    if (mode === 'new' && !initialised) {
      loadDefinition('', 'Untitled Workflow', {
        id: '', variables: [], nodes: [], edges: [], metadata: { version: 1 },
      })
      // Seed with entry + exit nodes
      addNode('entry', { x: 80,  y: 180 })
      addNode('exit',  { x: 520, y: 180 })
      setInitialised(true)
    }
    if (mode === 'edit' && existing && !initialised) {
      loadDefinition(existing.id, existing.name, existing.definition)
      setInitialised(true)
    }
  }, [mode, existing, initialised, loadDefinition, addNode])

  if (mode === 'edit' && isLoading) {
    return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSave = async () => {
    setSaveError(null)
    const def = toDefinition()
    const payload = { name, definition: def }
    try {
      if (mode === 'new') {
        const created = await createMutation.mutateAsync(payload)
        markSaved()
        navigate({ to: '/workflows/$workflowId', params: { workflowId: created.id } })
      } else {
        await updateMutation.mutateAsync(payload)
        markSaved()
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleRun = () => {
    if (!id) return
    triggerMutation.mutate(id, { onSuccess: (r) => setTriggeredId(r.execution_id) })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm">
        <Link to="/workflows">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700">
            <ArrowLeft size={16} />
          </Button>
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
          <Workflow size={16} className="text-white" />
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-60 border-0 bg-transparent px-1.5 text-[15px] font-semibold text-slate-800 shadow-none focus-visible:bg-slate-50 focus-visible:ring-0"
            placeholder="Workflow name…"
          />
          {isDirty && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Unsaved
            </span>
          )}
        </div>

        <div className="flex-1" />

        {saveError && (
          <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">
            <AlertCircle size={13} />{saveError}
          </span>
        )}

        {triggeredId && (
          <Link
            to="/executions/$executionId"
            params={{ executionId: triggeredId }}
            className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <CheckCircle size={13} />Execution running
          </Link>
        )}

        {mode === 'edit' && (
          <Button variant="outline" size="sm" onClick={handleRun} disabled={triggerMutation.isPending}>
            {triggerMutation.isPending ? <Spinner className="h-4 w-4" /> : <Play size={13} />}
            Run
          </Button>
        )}

        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Spinner className="h-4 w-4" /> : <Save size={13} />}
          {mode === 'new' ? 'Create' : 'Save'}
        </Button>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <VariablesPanel />
        <FlowLayout />
        <NodeConfigPanel />
      </div>
    </div>
  )
}
