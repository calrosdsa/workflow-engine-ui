import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCreateWorkflow, useUpdateWorkflow, useWorkflow } from "@/features/workflows/hooks";
import { useBuilderStore } from "@/features/workflows/builder/store";
import { useTriggerExecution } from "@/features/executions/hooks";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { FlowLayout } from "./Layout";
import { VariablesPanel } from "@/features/workflows/builder/VariablesPanel";
import { NodeConfigPanel } from "@/features/workflows/builder/NodeConfigPanel";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, CheckCircle, Play, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
export type BuilderMode = 'new' | 'edit'

interface WorkflowBuilderPageProps {
  mode: BuilderMode
}
export default function TestLayout({mode}:WorkflowBuilderPageProps){
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
        navigate({ to: '/workflows/$workflowId', params: { workflowId: created.id } as any})
        } else {
        await updateMutation.mutateAsync(payload)
        markSaved()
        }
    } catch (e: unknown) {
        console.error('Save failed', e)
        setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
    }

    const handleRun = () => {
    if (!id) return
    triggerMutation.mutate(id, { onSuccess: (r) => setTriggeredId(r.execution_id) })
    }

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3 shadow-sm z-20">
        <Link to="/workflows">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={15} />
          </Button>
        </Link>

        <div className="h-4 w-px bg-gray-200" />

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 w-56 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0 focus-visible:bg-gray-50"
          placeholder="Workflow name…"
        />

        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}

        <div className="flex-1" />

        {saveError && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={12} />{saveError}
          </span>
        )}

        {triggeredId && (
          <Link
            to="/executions/$executionId"
            params={{ executionId: triggeredId } as any}
            className="flex items-center gap-1 text-xs text-green-700 hover:underline"
          >
            <CheckCircle size={12} />Execution running
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
        {/* <FlowCanvas /> */}
         <FlowLayout/>
        <NodeConfigPanel />
      </div>
    </div>
    )
}