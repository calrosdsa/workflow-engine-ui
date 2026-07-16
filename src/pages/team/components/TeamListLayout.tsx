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
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-3">
        <button
          onClick={() => onSelectApp(null)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
            selectedAppId === null ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50',
          )}
        >
          <Layers size={14} />
          All
        </button>
        <div className="mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => onSelectApp(app.id)}
              className={cn(
                'block w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                selectedAppId === app.id ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              {app.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          {primaryAction ? (
            <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : <span />}
          <div className="relative w-64">
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
