import { useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Palette, ListTree, Smartphone, Settings2 } from 'lucide-react'
import { ThemeSection } from './sections/ThemeSection'
import { MenusSection } from './sections/MenusSection'
import { MobileLayoutSection } from './sections/MobileLayoutSection'
import { GeneralSettingsSection } from './sections/GeneralSettingsSection'
import { useApplication } from '@/features/applications/hooks'
import { Spinner } from '@/components/ui/spinner'

type Tab = 'theme' | 'menus' | 'mobile' | 'general'

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'menus', label: 'Menus', icon: ListTree },
  { id: 'mobile', label: 'Mobile Layout', icon: Smartphone },
  { id: 'general', label: 'General', icon: Settings2 },
]

// Merges the old ApplicationBuilderPage's Theme + Menus + General tabs into
// one "App Design" section under /applications/$appId/design. The active
// tab is plain useState (switching tabs doesn't push a URL entry), but its
// INITIAL value honors the route's ?tab= search param — set by, e.g., the
// dashboard editor's "back" link — so a deep link lands on the right tab
// instead of always resetting to Theme.
export function AppDesignPage({ appId }: { appId: string }) {
  const { data: app, isLoading } = useApplication()
  const search = useSearch({ from: '/shell/applications/$appId/design' })
  const [tab, setTab] = useState<Tab>(search.tab ?? 'theme')

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!app) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b bg-white px-4 py-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'theme' && <ThemeSection />}
        {tab === 'menus' && <MenusSection appId={appId} />}
        {tab === 'mobile' && <MobileLayoutSection appId={appId} />}
        {tab === 'general' && <GeneralSettingsSection app={app} />}
      </div>
    </div>
  )
}
