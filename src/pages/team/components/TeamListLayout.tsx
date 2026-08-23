import { Search, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AppSummary } from '@/features/applications/types'

interface TeamListLayoutProps {
  apps: AppSummary[]
  selectedAppId: string | null
  onSelectApp: (appId: string | null) => void
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  primaryAction?: { label: string; onClick: () => void }
  children: React.ReactNode
}

/** Shared shell for the Users and Roles tabs: a left app-tree sidebar ("All"
 *  plus one entry per app) and a toolbar (primary action + search) above the
 *  list content, matching the reference "Users and Access" layout both tabs
 *  are modeled on. */
export function TeamListLayout({
  apps, selectedAppId, onSelectApp, search, onSearchChange, searchPlaceholder, primaryAction, children,
}: TeamListLayoutProps) {
  return (
    // A fixed w-56 sidebar beside a toolbar pairing a primary-action button
    // with a hard w-64 search input, with no responsive classes anywhere,
    // left no room for either at phone width. Below `md` the sidebar
    // becomes a horizontal, scrollable app-picker strip above the content
    // (rather than a stacked full-height block, which would push the
    // actual list below the fold) and the toolbar stacks its two controls
    // instead of forcing them side by side.
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-gray-200 bg-white p-3 md:w-56 md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex gap-1 md:block md:space-y-0.5">
          <button
            onClick={() => onSelectApp(null)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors md:w-full',
              selectedAppId === null ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Layers size={14} />
            All
          </button>
          <div className="flex gap-1 md:mt-0.5 md:block md:space-y-0.5 md:border-l md:border-gray-200 md:pl-3">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => onSelectApp(app.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm transition-colors md:block md:w-full md:truncate',
                  selectedAppId === app.id ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {primaryAction ? (
            <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : <span />}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
