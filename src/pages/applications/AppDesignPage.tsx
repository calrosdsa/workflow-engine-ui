import { useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Palette, ListTree, Smartphone } from 'lucide-react'
import { ThemeSection } from './sections/ThemeSection'
import { MenusSection } from './sections/MenusSection'
import { MobileLayoutSection } from './sections/MobileLayoutSection'
import { useApplication } from '@/features/applications/hooks'
import { Spinner } from '@/components/ui/spinner'

export type DesignTab = 'theme' | 'menus' | 'mobile'

// Design surfaces only. General/Reports/Version History/Environment Link/
// Marketplace moved to App Configuration (AppConfigurationPage) — they
// configure the app rather than design it, and nine tabs in one bar was
// covering two different jobs at once. Agents moved further, to its own
// top-level nav destination.
const TABS: { id: DesignTab; label: string; icon: typeof Palette }[] = [
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'menus', label: 'Menus', icon: ListTree },
  { id: 'mobile', label: 'Mobile Layout', icon: Smartphone },
]

// "App Design" under /applications/$appId/design — the app's design-time
// surfaces (theme, navigation, mobile layout, agents). The active
// tab is plain useState (switching tabs doesn't push a URL entry), but its
// INITIAL value honors the route's ?tab= search param — set by, e.g., the
// dashboard editor's "back" link — so a deep link lands on the right tab
// instead of always resetting to Theme.
export function AppDesignPage({ appId }: { appId: string }) {
  const { data: app, isLoading } = useApplication()
  const search = useSearch({ from: '/shell/applications/$appId/design' })
  const [tab, setTab] = useState<DesignTab>(search.tab ?? 'theme')

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!app) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
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
        {tab === 'theme' && <ThemeSection />}
        {tab === 'menus' && <MenusSection appId={appId} />}
        {tab === 'mobile' && <MobileLayoutSection appId={appId} />}
      </div>
    </div>
  )
}
