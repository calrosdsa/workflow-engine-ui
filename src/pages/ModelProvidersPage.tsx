import { useState } from 'react'
import { Cpu } from 'lucide-react'
import { usePermission } from '@/features/auth/permissions'
import { DefaultModelsSection } from '@/features/model-providers/DefaultModelsSection'
import { AddedModelsList } from '@/features/model-providers/AddedModelsList'
import { AvailableModelsPanel } from '@/features/model-providers/AvailableModelsPanel'
import { AddProviderDialog } from '@/features/model-providers/AddProviderDialog'
import type { ProviderType } from '@/features/model-providers/types'

export function ModelProvidersPage() {
  const canWrite = usePermission('providers:write')
  const [addingProvider, setAddingProvider] = useState<ProviderType | null>(null)

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4">
        <Cpu size={16} className="text-[hsl(var(--primary))]" />
        <h1 className="text-sm font-semibold text-[hsl(var(--foreground))]">Model Providers</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <DefaultModelsSection canWrite={canWrite} />
          <AddedModelsList canWrite={canWrite} />
        </div>

        <div className="min-w-0 lg:border-l lg:border-[hsl(var(--border))] lg:pl-6">
          <AvailableModelsPanel onSelectProvider={canWrite ? setAddingProvider : () => {}} />
        </div>
      </div>

      <AddProviderDialog providerType={addingProvider} onOpenChange={(open) => { if (!open) setAddingProvider(null) }} />
    </div>
  )
}
