import { Label } from '@/components/ui/label'
import { ModelPicker } from './ModelPicker'
import { useDefaultModels, useSetDefaultModel } from './hooks'

// The "Set default models" section — 2 dropdowns only (LLM, Embedding) per
// this pass' scope; no VLM/ASR/Rerank/TTS rows, since rag-engine can't call
// those roles yet and there's nothing for a default to mean there.
export function DefaultModelsSection({ canWrite }: { canWrite: boolean }) {
  const { data: defaults } = useDefaultModels()
  const setDefaultMutation = useSetDefaultModel()

  return (
    <div className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[hsl(var(--foreground))]">Set default models</h2>
      <p className="mb-4 text-[12px] text-[hsl(var(--muted-foreground))]">
        The model a Knowledge Base or Agent uses when none is explicitly chosen.
      </p>

      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">LLM</Label>
          <ModelPicker
            value={defaults?.llm_model_id ?? undefined}
            onChange={(modelId) => { if (modelId && canWrite) setDefaultMutation.mutate({ capability: 'llm', model_id: modelId }) }}
            capability="llm"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Embedding</Label>
          <ModelPicker
            value={defaults?.embedding_model_id ?? undefined}
            onChange={(modelId) => { if (modelId && canWrite) setDefaultMutation.mutate({ capability: 'embedding', model_id: modelId }) }}
            capability="embedding"
          />
        </div>
      </div>
    </div>
  )
}
