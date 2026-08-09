import { ChevronsUpDown, Check, Building2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface ClientOption {
  clientId: string
  clientName: string
}

// A user's memberships can repeat the same client_id once per app (plus a
// possible client-wide row) — dedupe to one entry per client_id for the
// switcher, keeping whichever membership happened to carry a real
// client_name (client-wide/Super Admin rows and per-app rows both have it,
// so the first one wins).
function distinctClients(memberships: { client_id: string; client_name?: string }[]): ClientOption[] {
  const seen = new Map<string, ClientOption>()
  for (const m of memberships) {
    if (!seen.has(m.client_id)) {
      seen.set(m.client_id, { clientId: m.client_id, clientName: m.client_name || m.client_id })
    }
  }
  return [...seen.values()]
}

/** Global-chrome dropdown for switching which client's apps Home shows.
 *  Hidden entirely for single-client users — only rendered by callers when
 *  there's more than one option, per AppShell's usage. */
export function ClientSwitcher() {
  const session = useAuthStore((s) => s.session)
  const activeClientId = useAuthStore((s) => s.activeClientId)
  const setActiveClientId = useAuthStore((s) => s.setActiveClientId)

  const clients = distinctClients(session?.memberships ?? [])
  if (clients.length < 2) return null

  const active = clients.find((c) => c.clientId === activeClientId) ?? clients[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-[hsl(var(--accent))]"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
        >
          <Building2 size={14} className="shrink-0 opacity-60" />
          <span className="max-w-[160px] truncate">{active?.clientName}</span>
          <ChevronsUpDown size={13} className="shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {clients.map((c) => (
          <DropdownMenuItem key={c.clientId} onClick={() => setActiveClientId(c.clientId)} className="justify-between">
            <span className="truncate">{c.clientName}</span>
            {c.clientId === active?.clientId && <Check size={13} className={cn('shrink-0')} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
