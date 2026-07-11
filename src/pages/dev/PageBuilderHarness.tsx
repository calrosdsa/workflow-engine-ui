// Throwaway verification harness for the page-builder canvas (Phase 4 of the
// Custom MenuType plan) — mounts PageBuilderDnd + PageToolbox + PageCanvas
// standalone, with no backend/menu dependency, so the DnD canvas can be
// exercised before CustomMenuConfigPanel (Phase 5) provides the real
// integration point. Not linked from any nav; reachable only by navigating
// directly to /dev/page-builder. Mirrors pages/dev/FormRendererHarness.tsx's
// precedent for this kind of isolated interactive verification.
import { usePageBuilderStore } from '@/features/page-builder/store'
import { PageBuilderDnd } from '@/features/page-builder/canvas/PageBuilderDnd'
import { PageCanvas } from '@/features/page-builder/canvas/PageCanvas'
import { PageToolbox } from '@/features/page-builder/Toolbox'

export function PageBuilderHarness() {
  const schema = usePageBuilderStore((s) => s.schema)

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <h1 className="text-sm font-semibold">Page Builder harness</h1>
      </div>
      <div className="flex min-h-0 flex-1">
        <PageBuilderDnd>
          <PageToolbox />
          <PageCanvas />
        </PageBuilderDnd>
        <div className="w-80 shrink-0 overflow-y-auto border-l bg-slate-900 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Live schema</p>
          <pre className="text-[10px] text-emerald-300">{JSON.stringify(schema, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
