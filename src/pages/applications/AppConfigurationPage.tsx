import { useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Settings2, KeyRound, FileBarChart, History, GitBranch, Store } from 'lucide-react'
import { GeneralSettingsSection } from './sections/GeneralSettingsSection'
import { GlobalSettingsSection } from './sections/GlobalSettingsSection'
import { ReportsSection } from './sections/ReportsSection'
import { VersionHistorySection } from './sections/VersionHistorySection'
import { EnvironmentLinkSection } from './sections/EnvironmentLinkSection'
import { MarketplaceSection } from './sections/MarketplaceSection'
import { useApplication } from '@/features/applications/hooks'
import { Spinner } from '@/components/ui/spinner'

export type ConfigTab = 'general' | 'settings' | 'reports' | 'versions' | 'environment' | 'marketplace'

const TABS: { id: ConfigTab; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'settings', label: 'Settings', icon: KeyRound },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'versions', label: 'Version History', icon: History },
  { id: 'environment', label: 'Environment Link', icon: GitBranch },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
]

/** App Configuration — everything about how an app is set up, released and
 *  distributed, as opposed to how it looks and behaves.
 *
 *  Split out of App Design, which had grown to nine tabs covering two
 *  genuinely different jobs: designing the app's surfaces (theme, menus,
 *  mobile layout, agents) and configuring the app itself (its name and
 *  settings, its credentials and variables, its reports, its version
 *  history, its environment link, its marketplace listing). App Design
 *  keeps the first; this page takes the second, and absorbs the former
 *  top-level Settings nav item as its own tab rather than leaving app
 *  configuration split across two places.
 *
 *  Mirrors AppDesignPage's tab mechanics exactly — local state seeded from
 *  ?tab= so deep links land correctly, no URL entry per tab switch. */
export function AppConfigurationPage({ appId }: { appId: string }) {
  const { data: app, isLoading } = useApplication()
  const search = useSearch({ from: '/shell/applications/$appId/configuration' })
  const [tab, setTab] = useState<ConfigTab>(search.tab ?? 'general')

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!app) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 ${
              tab === id
                ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'general' && <GeneralSettingsSection app={app} />}
        {tab === 'settings' && <GlobalSettingsSection />}
        {tab === 'reports' && <ReportsSection appId={appId} />}
        {tab === 'versions' && <VersionHistorySection publishedVersion={app.published_version} />}
        {tab === 'environment' && <EnvironmentLinkSection />}
        {tab === 'marketplace' && <MarketplaceSection />}
      </div>
    </div>
  )
}
