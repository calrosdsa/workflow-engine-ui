import { Bell, Check } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { runtimeRouter } from '@/runtime-router'
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from './hooks'
import type { Notification } from './api'

const SEVERITY_DOT: Record<Notification['severity'], string> = {
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface NotificationBellProps {
  clientId: string
  appId: string
}

export function NotificationBell({ clientId, appId }: NotificationBellProps) {
  const { data: unread } = useUnreadCount(true)
  const { data: notifications, isLoading } = useNotifications(true)
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const unreadCount = unread?.unread_count ?? 0

  const handleClick = (n: Notification) => {
    if (!n.read_at) markRead.mutate(n.id)
    if (n.link_url) {
      const target = n.link_url.startsWith('/') ? `/${clientId}/${appId}${n.link_url}` : n.link_url
      runtimeRouter.navigate({ to: target })
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-0 text-[hsl(var(--popover-foreground))]"
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
          <span className="text-xs font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              <Check size={11} />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : !notifications || notifications.length === 0 ? (
            <p className="p-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">You're all caught up.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex w-full items-start gap-2 border-b border-[hsl(var(--border))] px-3 py-2.5 text-left text-xs transition-colors last:border-b-0 hover:bg-[hsl(var(--accent))]',
                )}
              >
                <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', SEVERITY_DOT[n.severity])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{n.title}</span>
                  {n.body && <span className="block truncate text-[hsl(var(--muted-foreground))]">{n.body}</span>}
                  <span className="block text-[10px] text-[hsl(var(--muted-foreground))]">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
