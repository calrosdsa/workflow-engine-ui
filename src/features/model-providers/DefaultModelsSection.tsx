import { Label } from '@/components/ui/label'
import { ModelPicker } from './ModelPicker'
import { useDefaultModels, useSetDefaultModel } from './hooks'
import { useTranslation } from '@/features/i18n/I18nProvider'

// The "Set default models" section — 2 dropdowns only (LLM, Embedding) per
// this pass' scope; no VLM/ASR/Rerank/TTS rows, since rag-engine can't call
// those roles yet and there's nothing for a default to mean there.
export function DefaultModelsSection({ canWrite }: { canWrite: boolean }) {
  const t = useTranslation()
  const { data: defaults } = useDefaultModels()
  const setDefaultMutation = useSetDefaultModel()

  return (
    <div className="mb-6 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h2 className="mb-1 text-sm font-semibold text-[hsl(var(--foreground))]">{t('model_providers.set_defaults')}</h2>
      <p className="mb-4 text-[12px] text-[hsl(var(--muted-foreground))]">
        {t('model_providers.defaults_description')}
      </p>

      <div className="space-y-3">
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('model_providers.llm')}</Label>
          <ModelPicker
            value={defaults?.llm_model_id ?? undefined}
            onChange={(modelId) => { if (modelId && canWrite) setDefaultMutation.mutate({ capability: 'llm', model_id: modelId }) }}
            capability="llm"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('model_providers.embedding')}</Label>
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
