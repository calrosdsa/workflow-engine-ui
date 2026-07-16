import { LogOut } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/hooks'
import type { Me } from '@/features/auth/types'

interface ProfileMenuProps {
  session: Me
}

function displayName(session: Me): string {
  const full = [session.first_name, session.last_name].filter(Boolean).join(' ')
  return full || session.email
}

export function ProfileMenu({ session }: ProfileMenuProps) {
  const logout = useLogout()
  const name = displayName(session)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <Avatar name={name} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))]"
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-medium">{name}</p>
          <p className="truncate text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{session.email}</p>
        </div>
        <DropdownMenuSeparator className="bg-[hsl(var(--border))]" />
        <DropdownMenuItem destructive onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut size={13} />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
