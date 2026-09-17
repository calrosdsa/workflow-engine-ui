// The builder's right-hand rail — owns the ONE <aside> wrapper (width,
// border, background) that WorkbookRegionsPanel used to own by itself
// before RF-304 added a second tenant (DiagnosticsPanel) needing the same
// slot. Splitting them into tabs rather than stacking both panels
// vertically keeps each one full-height and scrollable on its own, which a
// stacked layout could not give either without an arbitrary height split.
import type { ReactNode } from 'react'
import { Database, ScanSearch } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from '@/features/i18n/I18nProvider'

export interface ReportRightRailProps {
  regions: ReactNode
  diagnostics: ReactNode
}

export function ReportRightRail({ regions, diagnostics }: ReportRightRailProps) {
  const t = useTranslation()
  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]" aria-label={t('reports.right_rail.aria')}>
      <Tabs defaultValue="regions" className="flex h-full min-h-0 flex-col">
        <TabsList className="shrink-0 px-2">
          <TabsTrigger value="regions" className="gap-1.5">
            <Database size={13} />
            {t('reports.right_rail.data_tab')}
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="gap-1.5">
            <ScanSearch size={13} />
            {t('reports.right_rail.diagnostics_tab')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="regions" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          {regions}
        </TabsContent>
        <TabsContent value="diagnostics" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          {diagnostics}
        </TabsContent>
      </Tabs>
    </aside>
  )
}
